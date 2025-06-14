import {
  ClientRegistration,
  ServerRegistration,
  ClientLogin,
  ServerLogin,
  OpaqueServer,
  OpaqueClient,
} from '@cloudflare/opaque-ts';

// Server-side OPAQUE instance
const server = new OpaqueServer();
const client = new OpaqueClient();

// Registration step 1: server creates registration response
export async function opaqueRegisterStart(email: string, registrationRequest: Uint8Array) {
  // In real app, you may want to salt/pepper email
  const { registrationResponse, serverState } = await server.createRegistrationResponse({
    registrationRequest,
    serverIdentity: email,
  });
  return { registrationResponse, serverState };
}

// Registration step 2: server stores record
export async function opaqueRegisterFinish(email: string, record: Uint8Array) {
  // Store record in DB (handled in route)
  return { email, record };
}

// Login step 1: server creates credential response
export async function opaqueLoginStart(email: string, credentialRequest: Uint8Array, record: Uint8Array) {
  const { credentialResponse, serverState } = await server.createCredentialResponse({
    credentialRequest,
    serverIdentity: email,
    record,
  });
  return { credentialResponse, serverState };
}

// Login step 2: server verifies credential finalization
export async function opaqueLoginFinish(serverState: any, credentialFinalization: Uint8Array) {
  const { sessionKey, clientIdentity } = await server.finalize({
    serverState,
    credentialFinalization,
  });
  return { sessionKey, clientIdentity };
} 