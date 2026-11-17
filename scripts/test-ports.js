// Tutti i server di prova restano nell'intervallo riservato a Mediateca.
export function demoPort(port) {
  if (!Number.isInteger(port) || port < 8870 || port > 8879) {
    throw new Error('Per le prove usa solo una porta fra 8870 e 8879.');
  }
  return port;
}

export async function listenForTest(server, { port, exclude = [] } = {}) {
  const ports = port === undefined ? Array.from({ length: 7 }, (_, i) => 8873 + i) : [demoPort(port)];
  for (const candidate of ports.filter(p => !exclude.includes(p))) {
    try {
      await new Promise((resolve, reject) => {
        const onError = error => { server.off('listening', onListening); reject(error); };
        const onListening = () => { server.off('error', onError); resolve(); };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(candidate, '127.0.0.1');
      });
      return server.address();
    } catch (error) {
      if (error.code !== 'EADDRINUSE' || port !== undefined) throw error;
    }
  }
  throw new Error('Nessuna porta di prova libera fra 8870 e 8879.');
}
