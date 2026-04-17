import { Client, ClientConfig } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface ResolvedAdminConnection {
  config: ClientConfig;
  hostTried: string[];
}

export async function withAdminClient<T>(
  config: ClientConfig,
  callback: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client(config);
  await client.connect();

  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}

function uniqueHosts(hosts: Array<string | undefined>): string[] {
  return [...new Set(hosts.filter((host): host is string => Boolean(host && host.trim())))];
}

export function getCandidateHosts(): string[] {
  return uniqueHosts([
    process.env.DB_HOST_TEST,
    process.env.DB_HOST,
    'localhost',
    '127.0.0.1',
    'postgres',
    'host.docker.internal',
  ]);
}

export async function resolveAdminConnection(): Promise<ResolvedAdminConnection> {
  const port = Number(process.env.DB_PORT ?? 5432);
  const user = process.env.DB_USER ?? 'postgres';
  const password = process.env.DB_PASSWORD ?? '';
  const database = 'postgres';
  const hostTried = getCandidateHosts();

  const errors: string[] = [];

  for (const host of hostTried) {
    const config: ClientConfig = {
      host,
      port,
      user,
      password,
      database,
      connectionTimeoutMillis: 3000,
    };

    try {
      await withAdminClient(config, async () => undefined);
      return { config, hostTried };
    } catch (error: any) {
      errors.push(`${host}:${port} -> ${error.code ?? error.message}`);
    }
  }

  throw new Error(
    [
      'Nao foi possivel conectar ao PostgreSQL para os testes E2E.',
      `Hosts tentados: ${hostTried.join(', ')}`,
      `Erros: ${errors.join(' | ')}`,
      'Se o teste estiver rodando no host, use DB_HOST_TEST=localhost.',
      'Se o teste estiver rodando dentro do container da API, use DB_HOST_TEST=postgres.',
    ].join('\n'),
  );
}
