import { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { analyzePhone } from '../spamsense.js';
import { CheckPhoneArgs } from '../types.js';

export const spamsenseCheckPhoneTool: Tool = {
  name: 'spamsense_check_phone',
  description:
    'Analyze a phone number for spam risk using pattern heuristics and optional blacklist. Returns JSON.',
  inputSchema: {
    type: 'object',
    properties: {
      number: { type: 'string', description: 'Phone number in any format' },
    },
    required: ['number'],
  },
};

function isCheckPhoneArgs(args: unknown): args is CheckPhoneArgs {
  return (
    typeof args === 'object' &&
    args !== null &&
    'number' in args &&
    typeof (args as { number: unknown }).number === 'string'
  );
}

export async function handleSpamsenseCheckPhone(args: unknown): Promise<CallToolResult> {
  try {
    if (!isCheckPhoneArgs(args)) {
      throw new Error('Invalid arguments for spamsense_check_phone');
    }

    const result = analyzePhone(args.number);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
      isError: false,
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

