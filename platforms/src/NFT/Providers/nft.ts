// ----- Types
import { ProviderExternalVerificationError, type Provider, type ProviderOptions } from "../../types";
import type { RequestPayload, VerifiedPayload } from "@gitcoin/passport-types";

// ----- Libs
import axios from "axios";

// ----- Credential verification
import { getAddress } from "../../utils/signer";

// ----- Utils
import { handleProviderAxiosError } from "../../utils/handleProviderAxiosError";

// Alchemy Api key
export const apiKey = process.env.ALCHEMY_API_KEY;

type GetContractsForOwnerResponse = {
  contracts: {
    address: string;
    tokenId: string;
  }[];
  totalCount: number;
};

export function getNFTEndpoint(): string {
  return `https://eth-mainnet.g.alchemy.com/nft/v2/${apiKey}/getContractsForOwner`;
}

// Export a NFT Provider
export class NFTProvider implements Provider {
  // Give the provider a type so that we can select it with a payload
  type = "NFT";

  // Options can be set here and/or via the constructor
  _options = {};

  // construct the provider instance with supplied options
  constructor(options: ProviderOptions = {}) {
    this._options = { ...this._options, ...options };
  }

  // Verify that address defined in the payload owns at least one POAP older than 15 days
  async verify(payload: RequestPayload): Promise<VerifiedPayload> {
    // if a signer is provider we will use that address to verify against
    const address = (await getAddress(payload)).toLowerCase();

    const errors = [];
    let valid = false,
      record = undefined;

    const { totalCount, contracts } = await this.queryNFTs(address);

    if (totalCount > 0) {
      const tokenAddress = contracts?.[0]?.address;
      const tokenId = contracts?.[0]?.tokenId;

      if (tokenAddress && tokenId) {
        valid = true;
        record = {
          tokenAddress,
          tokenId,
        };
      } else {
        throw new ProviderExternalVerificationError("Unable to find token info in response from NFT provider.");
      }
    } else {
      errors.push("You do not own any NFTs.");
    }

    return {
      valid,
      errors,
      record,
    };
  }

  async queryNFTs(address: string): Promise<GetContractsForOwnerResponse> {
    const providerUrl = getNFTEndpoint();
    try {
      return (
        await axios.get(providerUrl, {
          params: {
            withMetadata: "false",
            owner: address,
            pageSize: 1,
            orderBy: "transferTime",
          },
        })
      ).data as GetContractsForOwnerResponse;
    } catch (error) {
      handleProviderAxiosError(error, "getContractsForOwner", [apiKey]);
    }
  }
}
