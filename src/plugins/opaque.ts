let server: import('@cloudflare/opaque-ts').OpaqueServer | null = null;

async function getServer() {
  if (!server) {
    const { OpaqueServer } = await import('@cloudflare/opaque-ts');
    server = new OpaqueServer();
  }
  return server;
}

export async function opaqueRegisterStart(
  email: string,
  registrationRequest: Uint8Array
) {
  const srv = await getServer();
  const { registrationResponse, serverState } =
    await srv.createRegistrationResponse({
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
  const srv = await getServer();
  const { credentialResponse, serverState } =
    await srv.createCredentialResponse({
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
  const srv = await getServer();
  const { sessionKey, clientIdentity } = await srv.finalize({
    serverState,
    credentialFinalization,
  });
  return { sessionKey, clientIdentity };
}
