/**
 * Accepts SMTP on 127.0.0.1:1025 so invite-mail jobs do not crash the API
 * when nothing else is listening. CI sets MAIL_PORT=1025 and does not run a
 * mail server.
 */
const net = require('net');

const port = Number(process.env.SMTP_SINK_PORT || 1025);
const server = net.createServer((socket) => {
  socket.write('220 localhost ESMTP ready\r\n');
  let dataMode = false;

  socket.on('data', (buf) => {
    const text = buf.toString();
    if (dataMode) {
      if (text.includes('\n.\r\n') || text.includes('\r\n.\r\n')) {
        dataMode = false;
        socket.write('250 OK\r\n');
      }
      return;
    }

    const line = text.split(/\r?\n/).find((part) => part.length > 0) || '';
    if (/^DATA/i.test(line)) {
      dataMode = true;
      socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
      return;
    }
    if (/^QUIT/i.test(line)) {
      socket.write('221 Bye\r\n');
      socket.end();
      return;
    }
    socket.write('250 OK\r\n');
  });
});

server.listen(port, '127.0.0.1');
