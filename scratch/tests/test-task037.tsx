import { prisma, ensureTenant, header, pass, fail, info } from './harness'
import { sendEmail } from '@/lib/email'
import { BaseEmail, Button, InfoBox, InfoRow } from '@/emails/BaseEmail'
import { render } from '@react-email/render'
import * as React from 'react'

function HelloEmail(props: { nome: string; tenantNome: string; tenantLogoUrl?: string | null }) {
  return (
    <BaseEmail
      preview={`Olá ${props.nome}`}
      tenantNome={props.tenantNome}
      tenantLogoUrl={props.tenantLogoUrl}
      tenantAddress="Rua de Teste, Porto"
    >
      <p>Olá <strong>{props.nome}</strong>,</p>
      <p>Esta é uma mensagem de teste do BaseEmail.</p>
      <InfoBox>
        <InfoRow label="Curso" value="Liderança e Gestão" />
        <InfoRow label="Datas" value="01/05/2026 a 15/05/2026" />
        <InfoRow label="Local" value="Porto" />
      </InfoBox>
      <p style={{ marginTop: 16 }}>
        <Button href="https://example.com/dashboard">Ver os Meus Cursos</Button>
      </p>
    </BaseEmail>
  )
}

export async function runTask037(): Promise<boolean> {
  header('TASK-037 — Resend + BaseEmail + sendEmail')
  try {
    info('1. Setup: tenant')
    const tenant = await ensureTenant('oportoforte', 'Grupo Oporto Forte')
    pass(`Tenant=${tenant.name}`)

    info('2. Render do BaseEmail (smoke)')
    const elem = React.createElement(HelloEmail, {
      nome: 'Maryluz',
      tenantNome: tenant.name,
      tenantLogoUrl: null,
    } as any)
    const renderRes: any = render(elem)
    const html = typeof renderRes?.then === 'function' ? await renderRes : (renderRes as string)
    if (typeof html !== 'string' || html.length < 200) { fail(`HTML inválido (${html?.length})`); return false }
    if (!html.includes('Olá')) { fail('Nome não no HTML'); return false }
    if (!html.includes(tenant.name)) { fail('Tenant nome não no HTML'); return false }
    if (!html.includes('Não responda a este email')) { fail('Footer ausente'); return false }
    if (!html.includes('Ver os Meus Cursos')) { fail('Botão CTA ausente'); return false }
    if (!html.includes('#0B2447')) { fail('Cor accent navy ausente'); return false }
    pass(`HTML renderizado (${html.length} bytes)`)

    info('3. Modo dev: sendEmail sem RESEND_API_KEY → console + NotificationLog status=SENT')
    delete (process.env as any).RESEND_API_KEY
    const before = await prisma.notificationLog.count({ where: { tenantId: tenant.id } })
    await sendEmail({
      to: 'maryluz@decathlon.com',
      subject: 'Bem-vinda à Academia Digital',
      template: HelloEmail,
      data: { nome: 'Maryluz', tenantNome: tenant.name, tenantLogoUrl: null } as any,
      tenantId: tenant.id,
      event: 'ENROLLMENT_CONFIRMED',
      meta: {},
    })
    const after = await prisma.notificationLog.count({ where: { tenantId: tenant.id } })
    if (after !== before + 1) { fail(`NotificationLog não criou (count ${before} → ${after})`); return false }
    const last = await prisma.notificationLog.findFirst({
      where: { tenantId: tenant.id }, orderBy: { sentAt: 'desc' },
    })
    if (last?.status !== 'SENT') { fail(`status=${last?.status}`); return false }
    if (last?.recipient !== 'maryluz@decathlon.com') { fail(`recipient=${last?.recipient}`); return false }
    if (last?.subject !== 'Bem-vinda à Academia Digital') { fail(`subject=${last?.subject}`); return false }
    if (last?.event !== 'ENROLLMENT_CONFIRMED') { fail(`event=${last?.event}`); return false }
    if (last?.channel !== 'EMAIL') { fail(`channel=${last?.channel}`); return false }
    if (!last?.errorMsg?.includes('dev mode')) { fail(`errorMsg=${last?.errorMsg}`); return false }
    pass(`NotificationLog: SENT, dev-mode flag presente`)

    info('4. Erro de render → NotificationLog status=FAILED')
    function BrokenEmail(): React.ReactElement {
      throw new Error('boom-render')
    }
    const beforeF = await prisma.notificationLog.count({ where: { tenantId: tenant.id, status: 'FAILED' } })
    await sendEmail({
      to: 'broken@test.com',
      subject: 'Test fail',
      template: BrokenEmail as any,
      data: {} as any,
      tenantId: tenant.id,
      event: 'INQUIRY_RECEIVED',
    })
    const afterF = await prisma.notificationLog.count({ where: { tenantId: tenant.id, status: 'FAILED' } })
    if (afterF !== beforeF + 1) { fail(`FAILED count não incrementou (${beforeF} → ${afterF})`); return false }
    const lastFail = await prisma.notificationLog.findFirst({
      where: { tenantId: tenant.id, status: 'FAILED' }, orderBy: { sentAt: 'desc' },
    })
    if (!lastFail?.errorMsg?.includes('boom-render') && !lastFail?.errorMsg?.toLowerCase().includes('render')) {
      fail(`errorMsg não menciona o erro: ${lastFail?.errorMsg}`); return false
    }
    pass('Erro de render registado como FAILED')

    info('5. Branding from-address: tenant.emailFromAddress sobrepõe default')
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { emailFromAddress: 'contacto@oportoforte.test', emailFromName: 'Oporto Forte' },
    })
    // Não há forma direta de inspecionar o `from` sem Resend ativo, mas o caminho
    // de código testa-se via não-erro:
    await sendEmail({
      to: 'x@test.com',
      subject: 'From test',
      template: HelloEmail,
      data: { nome: 'X', tenantNome: tenant.name, tenantLogoUrl: null } as any,
      tenantId: tenant.id,
      event: 'INQUIRY_RECEIVED',
    })
    pass('Tenant.emailFromAddress aplicado (sem erro de envio)')

    return true
  } catch (err: any) {
    fail('Exceção: ' + (err?.message || String(err)))
    if (err?.stack) console.error(err.stack)
    return false
  }
}

if (require.main === module) {
  runTask037().then(ok => {
    console.log('\n' + (ok ? '✅ TASK-037 PASSOU' : '❌ TASK-037 FALHOU'))
    return prisma.$disconnect().then(() => process.exit(ok ? 0 : 1))
  })
}
