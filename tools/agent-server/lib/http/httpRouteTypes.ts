import { type IncomingMessage, type ServerResponse } from "node:http";
import { type createAgentWorldRuntime } from "../mcpRuntimeCore.ts";

type AgentWorldRuntime = ReturnType<typeof createAgentWorldRuntime>;

export interface EpochHttpRouteContext {
  readonly runtime: AgentWorldRuntime;
  readonly request: IncomingMessage;
  readonly response: ServerResponse;
  readonly method: string;
  readonly pathname: string;
  readonly allowedOrigins: string[];
  readonly maxBodyBytes: number;
  readonly persistEpochEvents: (result: unknown) => Promise<unknown>;
  readonly persistEpochResultPage: (result: unknown) => Promise<void>;
  readonly readJsonBody: (request: IncomingMessage, maxBodyBytes: number) => Promise<Record<string, unknown>>;
  readonly sendJson: (
    request: IncomingMessage,
    response: ServerResponse,
    status: number,
    value: unknown,
    allowedOrigins: string[],
  ) => void;
  readonly sendHtml: (
    request: IncomingMessage,
    response: ServerResponse,
    status: number,
    value: string,
    allowedOrigins: string[],
  ) => void;
  readonly queryParams: (request: IncomingMessage) => URLSearchParams;
}

export type SendBinary = (
  request: IncomingMessage,
  response: ServerResponse,
  status: number,
  value: Buffer,
  allowedOrigins: string[],
  headers: Record<string, string>,
) => void;

export type SendJsonDownload = (
  request: IncomingMessage,
  response: ServerResponse,
  status: number,
  value: unknown,
  allowedOrigins: string[],
  fileName: string,
) => void;

export type SendTextDownload = (
  request: IncomingMessage,
  response: ServerResponse,
  status: number,
  value: string,
  allowedOrigins: string[],
  fileName: string,
  contentType: string,
) => void;
