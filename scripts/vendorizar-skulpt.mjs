// Baixa o Skulpt do registro do npm, confere o hash e copia os arquivos para public/vendor/skulpt/.
// Uso: npm run vendor:skulpt
// Os arquivos gerados vão para o git: o build e o deploy não dependem de rede.
// Para trocar de versão, mude VERSAO e INTEGRIDADE (npm view skulpt@<versão> dist.integrity).

import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSAO = '1.2.0';
const INTEGRIDADE = 'sha512-T0cv0sdSOXLlIJTuyXSeYJ3TFdWYSZfX2PcBLpRKrKZ3dTbVQXRMiYudSuko2xzcyMif47DS2ShatCwjCbsSsA==';
const URL_PACOTE = `https://registry.npmjs.org/skulpt/-/skulpt-${VERSAO}.tgz`;
const ARQUIVOS = {
  'package/dist/skulpt.min.js': 'skulpt.min.js',
  'package/dist/skulpt-stdlib.js': 'skulpt-stdlib.js',
  'package/LICENSE': 'LICENSE',
};

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const destino = join(raiz, 'public', 'vendor', 'skulpt');

/** Lê um .tar (já descompactado) e devolve { caminho: conteúdo } dos arquivos comuns. */
function lerTar(tar) {
  const arquivos = {};
  let pos = 0;
  while (pos + 512 <= tar.length) {
    const cabecalho = tar.subarray(pos, pos + 512);
    if (cabecalho.every((b) => b === 0)) break;
    const texto = (inicio, fim) => cabecalho.subarray(inicio, fim).toString('utf8').replace(/\0.*$/s, '');
    const nome = texto(0, 100);
    const prefixo = texto(345, 500);
    const tamanho = parseInt(texto(124, 136).trim() || '0', 8);
    const tipo = String.fromCharCode(cabecalho[156] || 48);
    const caminho = prefixo ? `${prefixo}/${nome}` : nome;
    if (tipo === '0' || tipo === '\0') arquivos[caminho] = tar.subarray(pos + 512, pos + 512 + tamanho);
    pos += 512 + Math.ceil(tamanho / 512) * 512;
  }
  return arquivos;
}

const resposta = await fetch(URL_PACOTE);
if (!resposta.ok) throw new Error(`Falha ao baixar ${URL_PACOTE}: ${resposta.status}`);
const tgz = Buffer.from(await resposta.arrayBuffer());

const hash = `sha512-${createHash('sha512').update(tgz).digest('base64')}`;
if (hash !== INTEGRIDADE) throw new Error(`Hash não confere!\n esperado: ${INTEGRIDADE}\n recebido: ${hash}`);

const conteudo = lerTar(gunzipSync(tgz));
await mkdir(destino, { recursive: true });
for (const [origem, nome] of Object.entries(ARQUIVOS)) {
  const dados = conteudo[origem];
  if (!dados) throw new Error(`Arquivo ${origem} não encontrado no pacote`);
  await writeFile(join(destino, nome), dados);
  console.log(`✓ ${nome} (${(dados.length / 1024).toFixed(0)} KB)`);
}
await writeFile(
  join(destino, 'VERSAO.txt'),
  `skulpt ${VERSAO}\n${URL_PACOTE}\n${INTEGRIDADE}\nGerado por scripts/vendorizar-skulpt.mjs. Não edite à mão.\n`,
);
console.log(`Skulpt ${VERSAO} copiado para public/vendor/skulpt/`);
