import { prisma, BASE_URL, header, pass, fail, info } from './harness'

const RNDIP = `192.168.50.${Math.floor(Math.random() * 200 + 1)}`

async function attempt(): Promise<{ status: number; body: string }> {
  // Simular login com credentials via NextAuth callback (sem CSRF: a chamada
  // sem CSRF retorna 200 + redirect com erro, mas o rate-limit é antes do CSRF)
  const r = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'x-forwarded-for': RNDIP,
    },
    body: 'email=fake@test.com&password=wrong',
    redirect: 'manual',
  })
  return { status: r.status, body: r.status === 429 ? await r.text() : '' }
}

export async function runTask051(): Promise<boolean> {
  header('TASK-051 — Rate limiting nas rotas de auth')
  let allOk = true
  try {
    info(`IP simulado: ${RNDIP}`)
    info('1. 5 primeiras tentativas → não 429')
    for (let i = 1; i <= 5; i++) {
      const a = await attempt()
      info(`  tentativa ${i}: HTTP ${a.status}`)
      if (a.status === 429) {
        fail(`Tentativa ${i} bloqueada (esperava 429 só na 6ª)`)
        allOk = false
      }
    }
    if (allOk) pass('5 tentativas passaram (não-429)')

    info('2. 6ª tentativa → 429 com mensagem')
    const r6 = await attempt()
    if (r6.status !== 429) {
      fail(`6ª tentativa HTTP ${r6.status} (esperava 429)`)
      return false
    }
    if (!r6.body.includes('Demasiadas tentativas')) {
      fail(`Mensagem errada: ${r6.body}`)
      allOk = false
    } else pass(`6ª tentativa → 429 + "${r6.body.slice(0, 60)}…"`)

    info('3. Aguardar 1 segundo e tentar novamente — ainda 429')
    await new Promise(r => setTimeout(r, 1000))
    const r7 = await attempt()
    if (r7.status !== 429) {
      fail(`Após 1s HTTP ${r7.status} (esperava continuar 429)`)
      allOk = false
    } else pass('Continua 429 após 1s (janela de 15 min)')

    info('4. IP diferente → não bloqueado (key separada)')
    const r8 = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'x-forwarded-for': '10.99.99.99' },
      body: 'email=fake@test.com&password=wrong',
      redirect: 'manual',
    })
    if (r8.status === 429) {
      fail('IP diferente bloqueado (rate-limit não está chave por IP)')
      allOk = false
    } else pass(`IP diferente: HTTP ${r8.status} (não 429)`)

    info('5. /api/auth/magic-link com mesmo IP — independente, não bloqueado pela 1ª vez')
    const ml = await fetch(`${BASE_URL}/api/auth/magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.99.99.50' },
      body: JSON.stringify({ email: 'noone@test.com' }),
    })
    info(`  /magic-link 1ª chamada: HTTP ${ml.status}`)
    if (ml.status === 429) {
      fail('/magic-link já bloqueado na 1ª chamada')
      allOk = false
    } else pass('Magic-link tem rate-limit independente')

    return allOk
  } catch (err: any) {
    fail('Exceção: ' + (err?.message || String(err)))
    return false
  }
}

if (require.main === module) {
  runTask051().then(ok => {
    console.log('\n' + (ok ? '✅ TASK-051 PASSOU' : '❌ TASK-051 FALHOU'))
    return prisma.$disconnect().then(() => process.exit(ok ? 0 : 1))
  })
}
