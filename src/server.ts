import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  InitializedNotificationSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { spamsenseCheckPhoneTool, handleSpamsenseCheckPhone } from './tools/index.js';

export function createStandaloneServer(): Server {
  const serverInstance = new Server(
    {
      name: 'spamsense/mcp',
      version: '0.2.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  serverInstance.setNotificationHandler(InitializedNotificationSchema, async () => {
    console.log('Spamsense MCP client initialized');
  });

  serverInstance.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [spamsenseCheckPhoneTool],
  }));

  serverInstance.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    switch (name) {
      case 'spamsense_check_phone':
        return await handleSpamsenseCheckPhone(args);
      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  });

  return serverInstance;
}

export class SpamsenseServer {
  getServer(): Server {
    return createStandaloneServer();
  }
}

