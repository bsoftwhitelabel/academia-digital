import { renderCapa } from '@/templates/pdf/Capa'
import { renderEquipaFormativa } from '@/templates/pdf/EquipaFormativa'
import { renderFichaAcao } from '@/templates/pdf/FichaAcao'
import { renderFolhaPresencas } from '@/templates/pdf/FolhaPresencas'

const minimal = {
  action: {
    id: 'a1', actionCode: 'TEST',
    course: { name: 'Curso X', durationHours: 8, area: { name: 'Área' } },
    clientOrg: { name: 'Cliente' },
    room: null,
    trainers: [{ trainer: { user: { firstName: 'F', lastName: 'T' } }, role: 'MAIN' }],
    sessions: [{ id: 's1', sessionDate: new Date(), startTime: '09:00', endTime: '17:00', durationHours: 8 }],
    enrollments: [],
    occurrences: [],
    format: 'PRESENCIAL',
    startDate: new Date(),
    endDate: new Date(),
  },
  tenant: { name: 'Tenant', dgertCode: '123' },
  trainees: [],
  logos: { tenant: null, client: null, dgert: null },
} as any

console.log('Capa:', renderCapa(minimal).length, 'chars')
console.log('EquipaFormativa:', renderEquipaFormativa(minimal).length, 'chars')
console.log('FichaAcao:', renderFichaAcao(minimal).length, 'chars')
console.log('FolhaPresencas:', renderFolhaPresencas(minimal).length, 'chars')
