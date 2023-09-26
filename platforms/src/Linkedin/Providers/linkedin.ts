// ----- Types
import type { RequestPayload, VerifiedPayload } from "@gitcoin/passport-types";
import { ProviderExternalVerificationError, type Provider, type ProviderOptions } from "../../types";

// ----- Libs
import axios from "axios";

// ----- Utils
import { handleProviderAxiosError } from "../../utils/handleProviderAxiosError";

export type LinkedinTokenResponse = {
  access_token: string;
};

export type LinkedinFindMyUserResponse = {
  id?: string;
  firstName?: string;
  lastName?: string;
  error?: string;
};

// Export a Linkedin Provider to carry out OAuth and return a record object
export class LinkedinProvider implements Provider {
  // Give the provider a type so that we can select it with a payload
  type = "Linkedin";

  // Options can be set here and/or via the constructor
  _options = {};

  // construct the provider instance with supplied options
  constructor(options: ProviderOptions = {}) {
    this._options = { ...this._options, ...options };
  }

  // verify that the proof object contains valid === "true"
  async verify(payload: RequestPayload): Promise<VerifiedPayload> {
    const errors = [];
    let valid = false,
      verifiedPayload: LinkedinFindMyUserResponse = {},
      record = undefined;

    try {
      if (payload.proofs) {
        verifiedPayload = await verifyLinkedin(payload.proofs.code);
        valid = verifiedPayload && verifiedPayload.id ? true : false;

        if (valid) {
          record = {
            id: verifiedPayload.id,
          };
        } else {
          errors.push(
            `Error: we were unable to verify your LinkedIn account -- LinkedIn Account Valid: ${String(valid)}.`
          );
        }
      } else {
        errors.push(verifiedPayload.error);
      }
      return {
        valid,
        record,
        errors,
      };
    } catch (e: unknown) {
      throw new ProviderExternalVerificationError(`LinkedIn Account verification error: ${JSON.stringify(e)}.`);
    }
  }
}

const requestAccessToken = async (code: string): Promise<string> => {
  try {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

    const tokenRequest = await axios.post(
      `https://www.linkedin.com/oauth/v2/accessToken?grant_type=authorization_code&code=${code}&client_id=${clientId}&client_secret=${clientSecret}&redirect_uri=${process.env.LINKEDIN_CALLBACK}`,
      {},
      {
        headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    if (tokenRequest.status != 200) {
      throw `Post for request returned status code ${tokenRequest.status} instead of the expected 200`;
    }

    const tokenResponse = tokenRequest.data as LinkedinTokenResponse;

    return tokenResponse.access_token;
  } catch (e: unknown) {
    handleProviderAxiosError(e, "LinkedIn access token request");
    return String(e);
  }
};

const verifyLinkedin = async (code: string): Promise<LinkedinFindMyUserResponse> => {
  try {
    // retrieve user's auth bearer token to authenticate client
    const accessToken = await requestAccessToken(code);
    // Now that we have an access token fetch the user details
    const userRequest = await axios.get("https://api.linkedin.com/rest/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Linkedin-Version": 202305,
      },
    });

    return userRequest.data as LinkedinFindMyUserResponse;
  } catch (e: unknown) {
    handleProviderAxiosError(e, "LinkedIn verification", [code]);
    return e;
  }
};
