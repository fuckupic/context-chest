const Fastify = require('fastify');
const jwt = require('@fastify/jwt');
const app = Fastify({ logger: false });
app.register(jwt, { secret: 'dev-jwt-secret-change-in-prod' });

app.get('/test', async (req) => {
  try {
    await req.jwtVerify();
    return { ok: true, user: req.user };
  } catch(e) {
    return { ok: false, error: e.message };
  }
});

app.listen({ port: 3002 }).then(() => {
  console.log('listening on 3002');
});
