import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, CourseStatus, TrainingFormat } from "@prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

type Workshop = {
  bloco: number;
  blocoNome: string;
  titulo: string;
  shortDescription: string;
  emoji: string;
};

const WORKSHOPS: Workshop[] = [
  // Bloco 1 — Relação com o Trabalho
  { bloco: 1, blocoNome: "Relação com o Trabalho", titulo: "Relação com o Trabalho e Saúde Mental", shortDescription: "Compreender o impacto do trabalho na saúde mental e estratégias de equilíbrio.", emoji: "💼" },
  { bloco: 1, blocoNome: "Relação com o Trabalho", titulo: "Burnout: Reconhecer e Prevenir", shortDescription: "Identificar sinais de exaustão profissional e implementar mecanismos de prevenção.", emoji: "🔥" },
  { bloco: 1, blocoNome: "Relação com o Trabalho", titulo: "Fronteiras Saudáveis no Trabalho", shortDescription: "Estabelecer limites claros entre vida profissional e pessoal.", emoji: "🚧" },
  // Bloco 2 — Comunicação e Relacionamento
  { bloco: 2, blocoNome: "Comunicação e Relacionamento", titulo: "Comunicação Não-Violenta no Trabalho", shortDescription: "Aplicar a CNV de Marshall Rosenberg em interações profissionais diárias.", emoji: "🕊️" },
  { bloco: 2, blocoNome: "Comunicação e Relacionamento", titulo: "Gestão de Conflitos com Inteligência Emocional", shortDescription: "Resolver tensões interpessoais com empatia e assertividade.", emoji: "🤝" },
  { bloco: 2, blocoNome: "Comunicação e Relacionamento", titulo: "Feedback que Transforma", shortDescription: "Dar e receber feedback de forma construtiva e geradora de crescimento.", emoji: "💬" },
  // Bloco 3 — Foco e Produtividade
  { bloco: 3, blocoNome: "Foco e Produtividade", titulo: "Gestão do Tempo e Energia Mental", shortDescription: "Priorizar tarefas alinhadas com a sua energia ao longo do dia.", emoji: "⏱️" },
  { bloco: 3, blocoNome: "Foco e Produtividade", titulo: "Procrastinação: Causas e Soluções", shortDescription: "Identificar gatilhos de adiamento e ferramentas para superá-los.", emoji: "🐢" },
  { bloco: 3, blocoNome: "Foco e Produtividade", titulo: "Mindfulness Aplicado ao Trabalho", shortDescription: "Práticas de atenção plena para melhorar foco e reduzir distrações.", emoji: "🧘" },
  // Bloco 4 — Liderança e Saúde
  { bloco: 4, blocoNome: "Liderança e Saúde", titulo: "Liderança Consciente e Bem-Estar da Equipa", shortDescription: "Liderar com presença e cuidado, gerando ambientes saudáveis.", emoji: "🌟" },
  { bloco: 4, blocoNome: "Liderança e Saúde", titulo: "Gestão Emocional para Líderes", shortDescription: "Regular as próprias emoções para tomar decisões equilibradas.", emoji: "🎯" },
  { bloco: 4, blocoNome: "Liderança e Saúde", titulo: "Como Criar uma Cultura de Psicossegurança", shortDescription: "Construir equipas onde as pessoas sentem segurança para falar e errar.", emoji: "🛡️" },
  // Bloco 5 — IA e Saúde Mental
  { bloco: 5, blocoNome: "IA e Saúde Mental", titulo: "IA no Trabalho: Oportunidade ou Ameaça?", shortDescription: "Compreender o impacto da inteligência artificial nas suas funções e ansiedades.", emoji: "🤖" },
  { bloco: 5, blocoNome: "IA e Saúde Mental", titulo: "Gestão da Ansiedade Digital", shortDescription: "Estratégias para lidar com a sobrecarga informacional e digital.", emoji: "📵" },
  { bloco: 5, blocoNome: "IA e Saúde Mental", titulo: "Equilíbrio Humano-Digital", shortDescription: "Manter a humanidade e propósito num mundo cada vez mais automatizado.", emoji: "⚖️" },
  // Bloco 6 — Saúde Física e Energia
  { bloco: 6, blocoNome: "Saúde Física e Energia", titulo: "Ergonomia e Postura no Trabalho Remoto", shortDescription: "Configurar o posto de trabalho para preservar a saúde músculo-esquelética.", emoji: "🪑" },
  { bloco: 6, blocoNome: "Saúde Física e Energia", titulo: "Sono e Performance Profissional", shortDescription: "A ciência do sono e o seu impacto direto na produtividade.", emoji: "😴" },
  { bloco: 6, blocoNome: "Saúde Física e Energia", titulo: "Alimentação e Energia para o Trabalho", shortDescription: "Escolhas alimentares que sustentam o foco e a energia ao longo do dia.", emoji: "🥗" },
  // Bloco 7 — Inteligência Emocional
  { bloco: 7, blocoNome: "Inteligência Emocional", titulo: "Fundamentos da Inteligência Emocional", shortDescription: "Os 5 pilares da IE segundo Daniel Goleman aplicados ao quotidiano profissional.", emoji: "🧠" },
  { bloco: 7, blocoNome: "Inteligência Emocional", titulo: "Autoconhecimento e Autorregulação", shortDescription: "Desenvolver consciência das próprias emoções e capacidade de as gerir.", emoji: "🪞" },
  { bloco: 7, blocoNome: "Inteligência Emocional", titulo: "Empatia e Relações Profissionais", shortDescription: "Cultivar a empatia como motor de relações de qualidade no trabalho.", emoji: "❤️" },
  // Bloco 8 — Parentalidade e Trabalho
  { bloco: 8, blocoNome: "Parentalidade e Trabalho", titulo: "Conciliação Família-Trabalho", shortDescription: "Estratégias práticas para harmonizar responsabilidades familiares e profissionais.", emoji: "👨‍👩‍👧" },
  { bloco: 8, blocoNome: "Parentalidade e Trabalho", titulo: "Parentalidade Consciente e Performance", shortDescription: "A parentalidade como escola de liderança e autoconhecimento.", emoji: "🌱" },
  { bloco: 8, blocoNome: "Parentalidade e Trabalho", titulo: "Gestão da Culpa Parental", shortDescription: "Lidar com sentimentos de culpa que afetam o desempenho profissional.", emoji: "🤲" },
  // Bloco 9 — Bem-Estar Financeiro
  { bloco: 9, blocoNome: "Bem-Estar Financeiro", titulo: "Saúde Financeira como Pilar do Bem-Estar", shortDescription: "A relação entre estabilidade financeira e bem-estar global.", emoji: "💰" },
  { bloco: 9, blocoNome: "Bem-Estar Financeiro", titulo: "Stress Financeiro e Trabalho", shortDescription: "Como preocupações financeiras afetam o desempenho e como mitigar.", emoji: "📉" },
  { bloco: 9, blocoNome: "Bem-Estar Financeiro", titulo: "Planeamento Financeiro Pessoal", shortDescription: "Princípios básicos de planeamento financeiro adaptados a colaboradores.", emoji: "📊" },
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function main() {
  console.log("Workshops seed iniciado...\n");

  const tenant = await prisma.tenant.findUnique({ where: { slug: "oportoforte" } });
  if (!tenant) {
    console.error("Tenant 'oportoforte' não existe. Corre o seed principal primeiro.");
    process.exit(1);
  }

  // Garantir TrainingArea "Desenvolvimento pessoal e formação de formadores"
  let area = await prisma.trainingArea.findFirst({
    where: { name: { contains: "Desenvolvimento pessoal", mode: "insensitive" } },
  });
  if (!area) {
    area = await prisma.trainingArea.create({
      data: {
        name: "Desenvolvimento pessoal e formação de formadores",
        citeCode: "090",
        catalogVisible: true,
        catalogOrder: 1,
      },
    });
    console.log(`✓ Área criada: ${area.name}`);
  } else {
    console.log(`✓ Área existente: ${area.name}`);
  }

  let created = 0, updated = 0;

  for (const w of WORKSHOPS) {
    const slug = slugify(`workshop-${w.titulo}`);
    const tags = ["workshop", "saude-mental", "bem-estar", `bloco-${w.bloco}`, slugify(w.blocoNome)];

    const result = await prisma.course.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug } },
      update: {
        name: w.titulo,
        shortDescription: w.shortDescription,
        durationHours: 1,
        format: TrainingFormat.PRESENCIAL,
        status: CourseStatus.PUBLISHED,
        tags,
        areaId: area.id,
        targetAudience: "Colaboradores e líderes de organizações que valorizam saúde mental e bem-estar.",
        priceNotes: w.emoji + " Sob consulta — formato B2B.",
      },
      create: {
        tenantId: tenant.id,
        name: w.titulo,
        slug,
        shortDescription: w.shortDescription,
        durationHours: 1,
        format: TrainingFormat.PRESENCIAL,
        status: CourseStatus.PUBLISHED,
        publishedAt: new Date(),
        tags,
        areaId: area.id,
        targetAudience: "Colaboradores e líderes de organizações que valorizam saúde mental e bem-estar.",
        priceNotes: w.emoji + " Sob consulta — formato B2B.",
      },
    });

    if (result.publishedAt && result.createdAt.getTime() === result.updatedAt.getTime()) created++;
    else updated++;

    process.stdout.write(`  ${w.emoji} ${w.titulo.padEnd(50)} → ${result.slug}\n`);
  }

  console.log(`\n✅ Concluído: ${created} criados / ${updated} atualizados / ${WORKSHOPS.length} total`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
