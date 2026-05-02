import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway(Number(process.env.WS_PORT ?? 3001), {
  cors: {
    origin: '*',
  },
})
export class InappGateway implements OnGatewayConnection {
  private readonly logger = new Logger(InappGateway.name);

  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    const userId =
      (client.handshake.query.userId as string) ||
      ((client.handshake.auth as { userId?: string })?.userId ?? '');
    if (!userId) {
      this.logger.warn(`Client connected without userId, disconnecting...`);
      client.disconnect();
      return;
    }
    this.logger.log(`Client connected: ${client.id} for userId: ${userId}`);
    void client.join(`user_${userId}`);
  }
  emit(userId: string, payload: { subject?: string; body: string }) {
    this.server.to(`user_${userId}`).emit('notification', payload);
  }
}
