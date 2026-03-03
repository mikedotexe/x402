import type {
  PaymentPayload,
  PaymentRequirements,
  SchemeNetworkFacilitator,
  SettleResponse,
  VerifyResponse,
} from "@x402/core/types";
import {
  DEFAULT_MAX_SPONSORED_GAS,
  FT_TRANSFER_METHOD,
  ONE_YOCTO,
  isNearNetwork,
} from "../../constants";
import type { FacilitatorNearSigner } from "../../signer";
import type { ExactNearPayload } from "../../types";
import { decodeSignedDelegateActionB64, parseFtTransferArgs } from "../../utils";

/**
 * Facilitator-side NEAR exact-scheme implementation.
 */
export class ExactNearScheme implements SchemeNetworkFacilitator {
  readonly scheme = "exact";
  readonly caipFamily = "near:*";

  /**
   * Creates an ExactNearScheme.
   *
   * @param signer - Facilitator signer abstraction
   * @param maxSponsoredGas - Maximum allowed sponsored gas in function call
   */
  constructor(
    private readonly signer: FacilitatorNearSigner,
    private readonly maxSponsoredGas: bigint = DEFAULT_MAX_SPONSORED_GAS,
  ) {}

  /**
   * Returns extra data for facilitator supported kinds.
   *
   * @param _ - Network identifier (unused)
   * @returns Extra payload with relayer id if available
   */
  getExtra(_: string): Record<string, unknown> | undefined {
    const relayerId = this.signer.getRelayerIds()[0];
    if (!relayerId) {
      return undefined;
    }

    return {
      relayerId,
    };
  }

  /**
   * Returns all relayer identifiers managed by this facilitator.
   *
   * @param _ - Network identifier (unused)
   * @returns Relayer account IDs
   */
  getSigners(_: string): string[] {
    return [...this.signer.getRelayerIds()];
  }

  /**
   * Verifies NEAR payment payload against exact payment requirements.
   *
   * @param payload - Payment payload
   * @param requirements - Payment requirements
   * @returns Verification response
   */
  async verify(payload: PaymentPayload, requirements: PaymentRequirements): Promise<VerifyResponse> {
    try {
      if (payload.x402Version !== 2) {
        return this.invalid("invalid_x402_version");
      }

      if (payload.accepted.scheme !== this.scheme || requirements.scheme !== this.scheme) {
        return this.invalid("unsupported_scheme");
      }

      if (!isNearNetwork(requirements.network) || payload.accepted.network !== requirements.network) {
        return this.invalid("network_mismatch");
      }

      if (payload.accepted.asset !== requirements.asset) {
        return this.invalid("asset_mismatch");
      }

      if (payload.accepted.payTo !== requirements.payTo) {
        return this.invalid("pay_to_mismatch");
      }

      if (payload.accepted.amount !== requirements.amount) {
        return this.invalid("amount_mismatch");
      }

      const nearPayload = payload.payload as ExactNearPayload;
      if (!nearPayload || typeof nearPayload.signedDelegateAction !== "string") {
        return this.invalid("invalid_payload_shape");
      }

      const delegate = decodeSignedDelegateActionB64(nearPayload.signedDelegateAction);
      const payer = delegate.delegate_action.sender_id;

      const relayerId = requirements.extra?.relayerId;
      if (typeof relayerId !== "string") {
        return this.invalid("missing_relayer_id", payer);
      }

      if (!this.signer.getRelayerIds().includes(relayerId)) {
        return this.invalid("relayer_not_managed_by_facilitator", payer);
      }

      if (relayerId === payer) {
        return this.invalid("relayer_cannot_be_payer", payer);
      }

      const blockHeight = await this.signer.getCurrentBlockHeight(requirements.network);
      if (delegate.delegate_action.max_block_height <= blockHeight) {
        return this.invalid("delegate_action_expired", payer);
      }

      if (this.signer.isDelegateNonceUsed) {
        const replayed = await this.signer.isDelegateNonceUsed({
          senderId: delegate.delegate_action.sender_id,
          publicKey: delegate.delegate_action.public_key.data,
          nonce: delegate.delegate_action.nonce,
          network: requirements.network,
        });
        if (replayed) {
          return this.invalid("delegate_action_nonce_reused", payer);
        }
      }

      if (delegate.delegate_action.actions.length !== 1) {
        return this.invalid("invalid_action_count", payer);
      }

      const action = delegate.delegate_action.actions[0];
      if (action.kind !== "FunctionCall") {
        return this.invalid("unsupported_action_kind", payer);
      }

      if (action.data.methodName !== FT_TRANSFER_METHOD) {
        return this.invalid("invalid_method_name", payer);
      }

      if (action.data.deposit !== ONE_YOCTO) {
        return this.invalid("invalid_attached_deposit", payer);
      }

      if (action.data.gas > this.maxSponsoredGas) {
        return this.invalid("gas_limit_exceeded", payer);
      }

      if (delegate.delegate_action.receiver_id !== requirements.asset) {
        return this.invalid("token_contract_mismatch", payer);
      }

      const transfer = parseFtTransferArgs(action.data.args);
      if (transfer.receiver_id !== requirements.payTo) {
        return this.invalid("recipient_mismatch", payer);
      }

      if (transfer.amount !== requirements.amount) {
        return this.invalid("transfer_amount_mismatch", payer);
      }

      return {
        isValid: true,
        payer,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return {
        isValid: false,
        invalidReason: `verification_error:${reason}`,
      };
    }
  }

  /**
   * Settles a verified NEAR payment by submitting the signed delegate action.
   *
   * @param payload - Payment payload
   * @param requirements - Payment requirements
   * @returns Settlement response
   */
  async settle(payload: PaymentPayload, requirements: PaymentRequirements): Promise<SettleResponse> {
    const verified = await this.verify(payload, requirements);
    if (!verified.isValid) {
      return {
        success: false,
        errorReason: verified.invalidReason || "verification_failed",
        transaction: "",
        network: requirements.network,
        payer: verified.payer,
      };
    }

    const relayerId = requirements.extra?.relayerId;
    if (typeof relayerId !== "string") {
      return {
        success: false,
        errorReason: "missing_relayer_id",
        transaction: "",
        network: requirements.network,
        payer: verified.payer,
      };
    }

    const nearPayload = payload.payload as ExactNearPayload;

    try {
      const submitted = await this.signer.submitSignedDelegateAction({
        network: requirements.network,
        relayerId,
        signedDelegateAction: nearPayload.signedDelegateAction,
      });

      return {
        success: true,
        transaction: submitted.transaction,
        network: requirements.network,
        payer: verified.payer,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        errorReason: `settlement_failed:${reason}`,
        transaction: "",
        network: requirements.network,
        payer: verified.payer,
      };
    }
  }

  /**
   * Builds a standard invalid verify response.
   *
   * @param reason - Invalid reason string
   * @param payer - Optional payer account
   * @returns Verify response
   */
  private invalid(reason: string, payer?: string): VerifyResponse {
    return {
      isValid: false,
      invalidReason: reason,
      payer,
    };
  }
}
