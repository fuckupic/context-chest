import { OpaqueServer } from '@cloudflare/opaque-ts';

const server = new OpaqueServer();

export async function opaqueRegisterStart(
  email: string,
  registrationRequest: Uint8Array
) {
  const { registrationResponse, serverState } =
    await server.createRegistrationResponse({
      registrationRequest,
      serverIdentity: email,
    });
  return { registrationResponse, serverState };
}

export async function opaqueRegisterFinish(
  _email: string,
  record: Uint8Array
) {
  return { record };
}

export async function opaqueLoginStart(
  email: string,
  credentialRequest: Uint8Array,
  record: Uint8Array
) {
  const { credentialResponse, serverState } =
    await server.createCredentialResponse({
      credentialRequest,
      serverIdentity: email,
      record,
    });
  return { credentialResponse, serverState };
}

export async function opaqueLoginFinish(
  serverState: Uint8Array,
  credentialFinalization: Uint8Array
) {
  const { sessionKey, clientIdentity } = await server.finalize({
    serverState,
    credentialFinalization,
  });
  return { sessionKey, clientIdentity };
}
