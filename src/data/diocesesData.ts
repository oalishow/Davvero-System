export interface DiocesePix {
  key: string;
  keyType?: "CNPJ" | "E-mail" | "Telefone" | "Chave Aleatória" | "Outro";
  receiverName?: string;
  bankName?: string;
  city?: string;
  description?: string;
  qrCodeImageUrl?: string | null;
}

export interface DioceseVisibility {
  hideBishop?: boolean; // Ocultar Bispo / Perfil Episcopal
  hideCuria?: boolean; // Ocultar Dados da Cúria / Endereço e Horário
  hideContacts?: boolean; // Ocultar Barra Rápida de Contatos (WhatsApp, Telefone, Email, Maps)
  hidePix?: boolean; // Ocultar Chave PIX & Dízimo Diocesano
  hideSocial?: boolean; // Ocultar Redes Sociais & Portal Oficial
  hideLinks?: boolean; // Ocultar Links Linktree
  hidePatron?: boolean; // Ocultar Padroeiro(a)
  hideFoundationYear?: boolean; // Ocultar Ano de Fundação
}

export interface DioceseLink {
  id: string;
  title: string;
  subtitle?: string;
  url: string;
  category: "oficial" | "contato" | "social" | "pastoral" | "servico";
  iconName?: "globe" | "instagram" | "youtube" | "facebook" | "phone" | "message" | "mail" | "map" | "file-text" | "calendar" | "heart" | "users" | "shield" | "sparkles";
  isExternal?: boolean;
  highlight?: boolean;
}

export interface DioceseInfo {
  id: string;
  name: string;
  shortName: string;
  type: "Diocese" | "Arquidiocese";
  logoUrl?: string | null;
  logoSize?: number; // Tamanho em pixels (ex: 70 a 180, padrão ~100-112)
  logoBg?: "white" | "transparent" | "glass"; // Fundo do emblema/logo oficial
  bishop: {
    name: string;
    title: string;
    motto?: string;
    photoUrl?: string | null;
    photoSize?: number; // Tamanho em pixels (ex: 80 a 180, padrão ~112)
    photoZoom?: number; // Zoom da foto (100 a 180, padrão 100)
    emblemUrl?: string | null;
    emblemSize?: number; // Tamanho em pixels do brasão episcopal (ex: 60 a 180, padrão ~96)
    emblemBg?: "white" | "transparent" | "dark"; // Fundo do brasão episcopal
  };
  patron: string;
  foundationYear?: string;
  pix?: DiocesePix;
  curia: {
    address: string;
    neighborhood?: string;
    city: string;
    state: string;
    cep: string;
    mapsUrl: string;
    phone: string;
    phoneFormatted: string;
    whatsapp?: string;
    whatsappFormatted?: string;
    email: string;
    officeHours: string;
  };
  social: {
    website?: string;
    instagram?: string;
    youtube?: string;
    facebook?: string;
  };
  links: DioceseLink[];
  coverGradient: string;
  themeColor: string;
  visibility?: DioceseVisibility;
}

export function buildMapsUrl(
  address?: string,
  neighborhood?: string,
  city?: string,
  state?: string,
  cep?: string,
  fallbackName?: string
): string {
  const parts = [address, neighborhood, city, state, cep]
    .map(p => p?.trim())
    .filter(Boolean);

  if (parts.length > 0) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(", "))}`;
  }
  if (fallbackName) {
    return `https://www.google.com/maps/search/?api=1&query=Curia+Diocesana+${encodeURIComponent(fallbackName)}`;
  }
  return "";
}

export const DIOCESES_DATA: Record<string, DioceseInfo> = {
  MARÍLIA: {
    id: "MARÍLIA",
    name: "Diocese de Marília",
    shortName: "Marília",
    type: "Diocese",
    bishop: {
      name: "Dom Luiz Antonio Cipolini",
      title: "Bispo Diocesano",
      motto: "In humilitate cordis (Na humildade de coração)"
    },
    patron: "São Pedro Apóstolo / Nossa Senhora da Glória",
    foundationYear: "1952",
    pix: {
      key: "44.475.253/0001-44",
      keyType: "CNPJ",
      receiverName: "Mitra Diocesana de Marília",
      bankName: "Sicoob / Banco do Brasil",
      city: "Marília - SP",
      description: "Dízimo Diocesano, Manutenção da Cúria e Apoio aos Seminários"
    },
    curia: {
      address: "Av. Nelson Spielmann, 521",
      neighborhood: "Centro",
      city: "Marília",
      state: "SP",
      cep: "17509-001",
      mapsUrl: "https://www.google.com/maps/search/?api=1&query=Av.+Nelson+Spielmann,+521+-+Centro,+Marília+-+SP,+17509-001",
      phone: "+551434012360",
      phoneFormatted: "(14) 3401-2360",
      whatsapp: "5514997931811",
      whatsappFormatted: "(14) 99793-1811",
      email: "curia@diocesedemarilia.org.br",
      officeHours: "Segunda a Sexta, das 08h às 11h30 e das 13h às 17h"
    },
    social: {
      website: "https://diocesedemarilia.org.br",
      instagram: "https://instagram.com/diocesedemarilia",
      youtube: "https://youtube.com/@diocesedemariliaoficial",
      facebook: "https://facebook.com/diocesedemarilia"
    },
    coverGradient: "from-sky-700 via-sky-800 to-indigo-950",
    themeColor: "#0284c7",
    links: [
      {
        id: "marilia-site",
        title: "Portal Oficial da Diocese",
        subtitle: "Notícias, decretos e comunicados da Diocese de Marília",
        url: "https://diocesedemarilia.org.br",
        category: "oficial",
        iconName: "globe",
        isExternal: true,
        highlight: true
      },
      {
        id: "marilia-instagram",
        title: "Instagram Oficial (@diocesedemarilia)",
        subtitle: "Coberturas, transmissões e avisos diocesanos diários",
        url: "https://instagram.com/diocesedemarilia",
        category: "social",
        iconName: "instagram",
        isExternal: true
      },
      {
        id: "marilia-youtube",
        title: "Canal no YouTube",
        subtitle: "Missas, formações e mensagens do Bispo Diocesano",
        url: "https://youtube.com/@diocesedemariliaoficial",
        category: "social",
        iconName: "youtube",
        isExternal: true
      },
      {
        id: "marilia-facebook",
        title: "Página no Facebook",
        subtitle: "Publicações pastorais e interação comunitária",
        url: "https://facebook.com/diocesedemarilia",
        category: "social",
        iconName: "facebook",
        isExternal: true
      },
      {
        id: "marilia-chancelaria",
        title: "Chancelaria & Expediente",
        subtitle: "Orientações sobre certidões, provisões e atos canônicos",
        url: "https://diocesedemarilia.org.br/chancelaria",
        category: "servico",
        iconName: "file-text",
        isExternal: true
      },
      {
        id: "marilia-tribunal",
        title: "Tribunal Eclesiástico Interdiocesano",
        subtitle: "Processos de nulidade matrimonial e atendimento canônico",
        url: "https://diocesedemarilia.org.br/tribunal-eclesiastico",
        category: "servico",
        iconName: "shield",
        isExternal: true
      },
      {
        id: "marilia-vocacional",
        title: "Pastoral Vocacional & Seminários",
        subtitle: "Acompanhamento vocacional e Seminário Rainha dos Apóstolos / São José",
        url: "https://diocesedemarilia.org.br/vocacoes",
        category: "pastoral",
        iconName: "heart",
        isExternal: true
      },
      {
        id: "marilia-caritas",
        title: "Cáritas Diocesana de Marília",
        subtitle: "Ações solidárias, apoio comunitário e projetos sociais",
        url: "https://diocesedemarilia.org.br/caritas",
        category: "pastoral",
        iconName: "users",
        isExternal: true
      }
    ]
  },
  ASSIS: {
    id: "ASSIS",
    name: "Diocese de Assis",
    shortName: "Assis",
    type: "Diocese",
    bishop: {
      name: "Dom Argemiro de Azevedo, CMF",
      title: "Bispo Diocesano",
      motto: "Gaudium et Spes (Alegria e Esperança)"
    },
    patron: "São Francisco de Assis",
    foundationYear: "1928",
    pix: {
      key: "44.364.577/0001-09",
      keyType: "CNPJ",
      receiverName: "Mitra Diocesana de Assis",
      bankName: "Banco do Brasil",
      city: "Assis - SP",
      description: "Dízimo Diocesano, Manutenção da Cúria e Obras de Evangelização"
    },
    curia: {
      address: "Rua Dom José Lázaro Neves, 414 (CEDIPAS)",
      neighborhood: "Vila Xavier / Centro",
      city: "Assis",
      state: "SP",
      cep: "19800-000",
      mapsUrl: "https://www.google.com/maps/search/?api=1&query=Rua+Dom+Jos%C3%A9+L%C3%A1zaro+Neves,+414+-+Vila+Xavier,+Assis+-+SP",
      phone: "+551833222614",
      phoneFormatted: "(18) 3322-2614",
      whatsapp: "5518997862614",
      whatsappFormatted: "(18) 99786-2614",
      email: "curia@diocesedeassis.org",
      officeHours: "Segunda a sexta-feira, das 08h00 às 11h30 e das 13h30 às 17h00"
    },
    social: {
      website: "https://diocesedeassis.org",
      instagram: "https://instagram.com/diocesedeassis",
      youtube: "https://youtube.com/@diocesedeassis",
      facebook: "https://facebook.com/diocesedeassis"
    },
    coverGradient: "from-amber-700 via-amber-800 to-amber-950",
    themeColor: "#d97706",
    links: [
      {
        id: "assis-site",
        title: "Portal Oficial da Diocese de Assis",
        subtitle: "Notícias, clero, paróquias e comunicados episcopais",
        url: "https://diocesedeassis.org",
        category: "oficial",
        iconName: "globe",
        isExternal: true,
        highlight: true
      },
      {
        id: "assis-instagram",
        title: "Instagram Oficial (@diocesedeassis)",
        subtitle: "Notícias, coberturas em tempo real e orações",
        url: "https://instagram.com/diocesedeassis",
        category: "social",
        iconName: "instagram",
        isExternal: true
      },
      {
        id: "assis-youtube",
        title: "Canal no YouTube da Diocese de Assis",
        subtitle: "Transmissões das Missas e solenidades diocesanas",
        url: "https://youtube.com/@diocesedeassis",
        category: "social",
        iconName: "youtube",
        isExternal: true
      },
      {
        id: "assis-facebook",
        title: "Facebook Oficial da Diocese",
        subtitle: "Comunicação e avisos paroquiais da Diocese de Assis",
        url: "https://facebook.com/diocesedeassis",
        category: "social",
        iconName: "facebook",
        isExternal: true
      },
      {
        id: "assis-pastorais",
        title: "Guia de Paróquias & Setores Pastorais",
        subtitle: "Localização de todas as comunidades e horários de missas",
        url: "https://diocesedeassis.org",
        category: "pastoral",
        iconName: "map",
        isExternal: true
      },
      {
        id: "assis-vocacional",
        title: "Pastoral Vocacional Diocesana",
        subtitle: "Encontros de discernimento e acompanhamento de vocacionados",
        url: "https://diocesedeassis.org",
        category: "pastoral",
        iconName: "heart",
        isExternal: true
      }
    ]
  },
  LINS: {
    id: "LINS",
    name: "Diocese de Lins",
    shortName: "Lins",
    type: "Diocese",
    bishop: {
      name: "Dom João Gilberto de Moura",
      title: "Bispo Diocesano",
      motto: "In caritate servire (Servir com amor)"
    },
    patron: "Santo Antônio de Pádua",
    foundationYear: "1926",
    pix: {
      key: "49.886.071/0001-20",
      keyType: "CNPJ",
      receiverName: "Mitra Diocesana de Lins",
      bankName: "Banco do Brasil",
      city: "Lins - SP",
      description: "Dízimo Diocesano e Contribuições Pastorais"
    },
    curia: {
      address: "Rua Dom Pedro II, 45",
      neighborhood: "Centro",
      city: "Lins",
      state: "SP",
      cep: "16400-035",
      mapsUrl: "https://www.google.com/maps/search/?api=1&query=Rua+Dom+Pedro+II,+45+-+Centro,+Lins+-+SP,+16400-035",
      phone: "+551435333500",
      phoneFormatted: "(14) 3533-3500",
      whatsapp: "5514997453500",
      whatsappFormatted: "(14) 99745-3500",
      email: "curiadiocesana@diocesedelins.org.br",
      officeHours: "Segunda a Sexta, das 08h às 11h30 e das 13h às 17h"
    },
    social: {
      website: "https://diocesedelins.org.br",
      instagram: "https://instagram.com/diocesedelins",
      youtube: "https://youtube.com/@diocesedelins",
      facebook: "https://facebook.com/diocesedelins"
    },
    coverGradient: "from-emerald-700 via-emerald-800 to-teal-950",
    themeColor: "#059669",
    links: [
      {
        id: "lins-site",
        title: "Site Oficial da Diocese de Lins",
        subtitle: "Informativos, eventos, clero e história diocesana",
        url: "https://diocesedelins.org.br",
        category: "oficial",
        iconName: "globe",
        isExternal: true,
        highlight: true
      },
      {
        id: "lins-instagram",
        title: "Instagram (@diocesedelins)",
        subtitle: "Fotos das visitas pastorais, ordenações e avisos",
        url: "https://instagram.com/diocesedelins",
        category: "social",
        iconName: "instagram",
        isExternal: true
      },
      {
        id: "lins-youtube",
        title: "YouTube da Diocese de Lins",
        subtitle: "Programas, homilias e celebrações eucarísticas",
        url: "https://youtube.com/@diocesedelins",
        category: "social",
        iconName: "youtube",
        isExternal: true
      },
      {
        id: "lins-facebook",
        title: "Facebook Oficial da Diocese de Lins",
        subtitle: "Atualizações da chancelaria e pastorais",
        url: "https://facebook.com/diocesedelins",
        category: "social",
        iconName: "facebook",
        isExternal: true
      },
      {
        id: "lins-paroquias",
        title: "Relação de Paróquias & Padres",
        subtitle: "Contatos e localização das paróquias das 4 regiões pastorais",
        url: "https://diocesedelins.org.br/paroquias",
        category: "servico",
        iconName: "map",
        isExternal: true
      }
    ]
  },
  BAURU: {
    id: "BAURU",
    name: "Diocese de Bauru",
    shortName: "Bauru",
    type: "Diocese",
    bishop: {
      name: "Dom Rubens Sevilha, OCD",
      title: "Bispo Diocesano",
      motto: "Gratia et Pax (Graça e Paz)"
    },
    patron: "Divino Espírito Santo",
    foundationYear: "1964",
    pix: {
      key: "44.544.756/0001-83",
      keyType: "CNPJ",
      receiverName: "Mitra Diocesana de Bauru",
      bankName: "Sicoob / Banco do Brasil",
      city: "Bauru - SP",
      description: "Dízimo Diocesano, Cúria e Ações de Evangelização"
    },
    curia: {
      address: "Rua Gomes de Faria, 9-70",
      neighborhood: "Jardim Estoril",
      city: "Bauru",
      state: "SP",
      cep: "17016-160",
      mapsUrl: "https://www.google.com/maps/search/?api=1&query=Rua+Gomes+de+Faria,+9-70+-+Jardim+Estoril,+Bauru+-+SP,+17016-160",
      phone: "+551431044414",
      phoneFormatted: "(14) 3104-4414",
      whatsapp: "5514998124414",
      whatsappFormatted: "(14) 99812-4414",
      email: "curia@bispadobauru.org.br",
      officeHours: "Segunda a Sexta, das 08h às 12h e das 13h30 às 17h30"
    },
    social: {
      website: "https://bispadobauru.org.br",
      instagram: "https://instagram.com/diocesedebauru",
      youtube: "https://youtube.com/@diocesedebauru",
      facebook: "https://facebook.com/diocesedebauru"
    },
    coverGradient: "from-rose-700 via-rose-800 to-red-950",
    themeColor: "#e11d48",
    links: [
      {
        id: "bauru-site",
        title: "Portal do Bispado de Bauru",
        subtitle: "Notícias, agenda episcopal e orientações diocesanas",
        url: "https://bispadobauru.org.br",
        category: "oficial",
        iconName: "globe",
        isExternal: true,
        highlight: true
      },
      {
        id: "bauru-instagram",
        title: "Instagram Oficial (@diocesedebauru)",
        subtitle: "Avisos, celebrações e evangelização nas redes",
        url: "https://instagram.com/diocesedebauru",
        category: "social",
        iconName: "instagram",
        isExternal: true
      },
      {
        id: "bauru-youtube",
        title: "Canal do Bispado no YouTube",
        subtitle: "Vídeos pastorais, ordenações e transmissões",
        url: "https://youtube.com/@diocesedebauru",
        category: "social",
        iconName: "youtube",
        isExternal: true
      },
      {
        id: "bauru-facebook",
        title: "Facebook da Diocese de Bauru",
        subtitle: "Comunicação e avisos da Igreja de Bauru",
        url: "https://facebook.com/diocesedebauru",
        category: "social",
        iconName: "facebook",
        isExternal: true
      },
      {
        id: "bauru-pastorais",
        title: "Coordenação Diocesana de Pastoral",
        subtitle: "Plano de pastoral e subsídios para as comunidades",
        url: "https://bispadobauru.org.br/pastoral",
        category: "pastoral",
        iconName: "file-text",
        isExternal: true
      }
    ]
  },
  OURINHOS: {
    id: "OURINHOS",
    name: "Diocese de Ourinhos",
    shortName: "Ourinhos",
    type: "Diocese",
    bishop: {
      name: "Dom Eduardo Vieira dos Santos",
      title: "Bispo Diocesano",
      motto: "Caritas Christi Urget Nos (O Amor de Cristo nos impele)"
    },
    patron: "Senhor Bom Jesus da Cana Verde",
    foundationYear: "1998",
    pix: {
      key: "03.048.878/0001-88",
      keyType: "CNPJ",
      receiverName: "Mitra Diocesana de Ourinhos",
      bankName: "Banco do Brasil",
      city: "Ourinhos - SP",
      description: "Dízimo Diocesano e Sustentação das Pastorais"
    },
    curia: {
      address: "Rua Monsenhor Córdova, 185",
      neighborhood: "Centro",
      city: "Ourinhos",
      state: "SP",
      cep: "19900-022",
      mapsUrl: "https://www.google.com/maps/search/?api=1&query=Rua+Monsenhor+Córdova,+185+-+Centro,+Ourinhos+-+SP,+19900-022",
      phone: "+551433224112",
      phoneFormatted: "(14) 3322-4112",
      whatsapp: "5514997624112",
      whatsappFormatted: "(14) 99762-4112",
      email: "curia@diocesedeourinhos.org.br",
      officeHours: "Segunda a Sexta, das 08h às 11h30 e das 13h às 17h"
    },
    social: {
      website: "https://diocesedeourinhos.org.br",
      instagram: "https://instagram.com/diocese_de_ourinhos",
      youtube: "https://youtube.com/@diocesedeourinhos",
      facebook: "https://facebook.com/diocesedeourinhos"
    },
    coverGradient: "from-teal-700 via-teal-800 to-cyan-950",
    themeColor: "#0d9488",
    links: [
      {
        id: "ourinhos-site",
        title: "Portal Oficial da Diocese de Ourinhos",
        subtitle: "Notícias, clero, horários de missas e documentos",
        url: "https://diocesedeourinhos.org.br",
        category: "oficial",
        iconName: "globe",
        isExternal: true,
        highlight: true
      },
      {
        id: "ourinhos-instagram",
        title: "Instagram (@diocese_de_ourinhos)",
        subtitle: "Fotos, comunicados e eventos das paróquias",
        url: "https://instagram.com/diocese_de_ourinhos",
        category: "social",
        iconName: "instagram",
        isExternal: true
      },
      {
        id: "ourinhos-youtube",
        title: "YouTube da Diocese de Ourinhos",
        subtitle: "Transmissões e vídeos institucionais",
        url: "https://youtube.com/@diocesedeourinhos",
        category: "social",
        iconName: "youtube",
        isExternal: true
      },
      {
        id: "ourinhos-facebook",
        title: "Facebook Oficial da Diocese",
        subtitle: "Atualizações pastorais e litúrgicas",
        url: "https://facebook.com/diocesedeourinhos",
        category: "social",
        iconName: "facebook",
        isExternal: true
      }
    ]
  },
  "PRESIDENTE PRUDENTE": {
    id: "PRESIDENTE PRUDENTE",
    name: "Diocese de Presidente Prudente",
    shortName: "Pres. Prudente",
    type: "Diocese",
    bishop: {
      name: "Dom Benedito Gonçalves dos Santos",
      title: "Bispo Diocesano",
      motto: "Evangelizare Misit Me (Enviou-me para evangelizar)"
    },
    patron: "São Sebastião",
    foundationYear: "1960",
    pix: {
      key: "55.356.555/0001-23",
      keyType: "CNPJ",
      receiverName: "Mitra Diocesana de Presidente Prudente",
      bankName: "Banco do Brasil",
      city: "Presidente Prudente - SP",
      description: "Dízimo Diocesano e Obras da Igreja Particular de Prudente"
    },
    curia: {
      address: "Rua Padre João Goetz, 400",
      neighborhood: "Jardim Petrópolis",
      city: "Presidente Prudente",
      state: "SP",
      cep: "19060-440",
      mapsUrl: "https://www.google.com/maps/search/?api=1&query=Rua+Padre+João+Goetz,+400+-+Jardim+Petrópolis,+Presidente+Prudente+-+SP,+19060-440",
      phone: "+551839185000",
      phoneFormatted: "(18) 3918-5000",
      whatsapp: "5518997085000",
      whatsappFormatted: "(18) 99708-5000",
      email: "curia@diocesepresidenteprudente.com.br",
      officeHours: "Segunda a Sexta, das 08h às 12h e das 13h30 às 17h30"
    },
    social: {
      website: "https://diocesepresidenteprudente.com.br",
      instagram: "https://instagram.com/dioceseprudente",
      youtube: "https://youtube.com/@dioceseprudente",
      facebook: "https://facebook.com/dioceseprudente"
    },
    coverGradient: "from-indigo-700 via-indigo-800 to-slate-950",
    themeColor: "#4f46e5",
    links: [
      {
        id: "prudente-site",
        title: "Portal da Diocese de Presidente Prudente",
        subtitle: "Notícias, decretos, clero e agenda diocesana",
        url: "https://diocesepresidenteprudente.com.br",
        category: "oficial",
        iconName: "globe",
        isExternal: true,
        highlight: true
      },
      {
        id: "prudente-instagram",
        title: "Instagram (@dioceseprudente)",
        subtitle: "Destaques, coberturas fotográficas e novidades",
        url: "https://instagram.com/dioceseprudente",
        category: "social",
        iconName: "instagram",
        isExternal: true
      },
      {
        id: "prudente-youtube",
        title: "YouTube Diocese de Prudente",
        subtitle: "Vídeos pastorais e celebrações diocesanas",
        url: "https://youtube.com/@dioceseprudente",
        category: "social",
        iconName: "youtube",
        isExternal: true
      },
      {
        id: "prudente-facebook",
        title: "Facebook Diocese de Presidente Prudente",
        subtitle: "Publicações oficiais e partilha comunitária",
        url: "https://facebook.com/dioceseprudente",
        category: "social",
        iconName: "facebook",
        isExternal: true
      },
      {
        id: "prudente-chancelaria",
        title: "Chancelaria do Bispado",
        subtitle: "Certidões, Provisões e Atos Canônicos",
        url: "https://diocesepresidenteprudente.com.br/chancelaria",
        category: "servico",
        iconName: "file-text",
        isExternal: true
      }
    ]
  },
  ARAÇATUBA: {
    id: "ARAÇATUBA",
    name: "Diocese de Araçatuba",
    shortName: "Araçatuba",
    type: "Diocese",
    bishop: {
      name: "Dom Sergio Krzywy",
      title: "Bispo Diocesano",
      motto: "In Verbo Tuo (Pela Tua Palavra)"
    },
    patron: "Nossa Senhora Aparecida",
    foundationYear: "1994",
    pix: {
      key: "00.176.471/0001-72",
      keyType: "CNPJ",
      receiverName: "Mitra Diocesana de Araçatuba",
      bankName: "Sicoob Credicitrus / Banco do Brasil",
      city: "Araçatuba - SP",
      description: "Dízimo Diocesano, Cúria e Formação de Seminaristas"
    },
    curia: {
      address: "Rua Floriano Peixoto, 218",
      neighborhood: "Centro",
      city: "Araçatuba",
      state: "SP",
      cep: "16010-220",
      mapsUrl: "https://www.google.com/maps/search/?api=1&query=Rua+Floriano+Peixoto,+218+-+Centro,+Araçatuba+-+SP,+16010-220",
      phone: "+551836234554",
      phoneFormatted: "(18) 3623-4554",
      whatsapp: "5518996544554",
      whatsappFormatted: "(18) 99654-4554",
      email: "chancelaria@diocesearacatuba.com.br",
      officeHours: "Segunda a Sexta, das 08h às 11h30 e das 13h30 às 17h30"
    },
    social: {
      website: "https://diocesearacatuba.com.br",
      instagram: "https://instagram.com/diocesearacatuba",
      youtube: "https://youtube.com/@diocesearacatuba",
      facebook: "https://facebook.com/diocesearacatuba"
    },
    coverGradient: "from-blue-700 via-blue-800 to-indigo-950",
    themeColor: "#2563eb",
    links: [
      {
        id: "aracatuba-site",
        title: "Portal da Diocese de Araçatuba",
        subtitle: "Notícias, diretrizes pastorais, clero e paróquias",
        url: "https://diocesearacatuba.com.br",
        category: "oficial",
        iconName: "globe",
        isExternal: true,
        highlight: true
      },
      {
        id: "aracatuba-instagram",
        title: "Instagram Oficial (@diocesearacatuba)",
        subtitle: "Acompanhe as celebrações e comunicados diocesanos",
        url: "https://instagram.com/diocesearacatuba",
        category: "social",
        iconName: "instagram",
        isExternal: true
      },
      {
        id: "aracatuba-youtube",
        title: "YouTube Diocese de Araçatuba",
        subtitle: "Missas, formações e eventos ao vivo",
        url: "https://youtube.com/@diocesearacatuba",
        category: "social",
        iconName: "youtube",
        isExternal: true
      },
      {
        id: "aracatuba-facebook",
        title: "Facebook Oficial da Diocese de Araçatuba",
        subtitle: "Informativos e notícias da Igreja diocesana",
        url: "https://facebook.com/diocesearacatuba",
        category: "social",
        iconName: "facebook",
        isExternal: true
      }
    ]
  },
  BOTUCATU: {
    id: "BOTUCATU",
    name: "Arquidiocese de Botucatu",
    shortName: "Botucatu",
    type: "Arquidiocese",
    bishop: {
      name: "Dom Maurício Grotto de Camargo",
      title: "Arcebispo Metropolitano",
      motto: "Gaudete in Domino (Alegrai-vos no Senhor)"
    },
    patron: "Sant'Ana",
    foundationYear: "1908 (Erigida) / 1958 (Elevada a Arquidiocese)",
    pix: {
      key: "46.634.345/0001-08",
      keyType: "CNPJ",
      receiverName: "Mitra Arquidiocesana de Botucatu",
      bankName: "Banco do Brasil",
      city: "Botucatu - SP",
      description: "Dízimo Arquidiocesano, Manutenção e Apoio Pastoral"
    },
    curia: {
      address: "Rua Dr. Costa Leite, 536",
      neighborhood: "Centro",
      city: "Botucatu",
      state: "SP",
      cep: "18600-010",
      mapsUrl: "https://www.google.com/maps/search/?api=1&query=Rua+Dr.+Costa+Leite,+536+-+Centro,+Botucatu+-+SP,+18600-010",
      phone: "+551438820744",
      phoneFormatted: "(14) 3882-0744",
      whatsapp: "5514997780744",
      whatsappFormatted: "(14) 99778-0744",
      email: "curia@arquidiocesebotucatu.org.br",
      officeHours: "Segunda a Sexta, das 08h às 11h30 e das 13h às 17h"
    },
    social: {
      website: "https://arquidiocesebotucatu.org.br",
      instagram: "https://instagram.com/arquidiocesebotucatu",
      youtube: "https://youtube.com/@arquidiocesebotucatu",
      facebook: "https://facebook.com/arquidiocesebotucatu"
    },
    coverGradient: "from-purple-700 via-purple-800 to-indigo-950",
    themeColor: "#7e22ce",
    links: [
      {
        id: "botucatu-site",
        title: "Portal da Arquidiocese de Botucatu",
        subtitle: "Notícias da Província Eclesiástica, clero e pastorais",
        url: "https://arquidiocesebotucatu.org.br",
        category: "oficial",
        iconName: "globe",
        isExternal: true,
        highlight: true
      },
      {
        id: "botucatu-instagram",
        title: "Instagram (@arquidiocesebotucatu)",
        subtitle: "Eventos, celebrações e mensagens do Arcebispo",
        url: "https://instagram.com/arquidiocesebotucatu",
        category: "social",
        iconName: "instagram",
        isExternal: true
      },
      {
        id: "botucatu-youtube",
        title: "YouTube Arquidiocese de Botucatu",
        subtitle: "Transmissões arquidiocesanas e documentos em vídeo",
        url: "https://youtube.com/@arquidiocesebotucatu",
        category: "social",
        iconName: "youtube",
        isExternal: true
      },
      {
        id: "botucatu-facebook",
        title: "Facebook da Arquidiocese",
        subtitle: "Publicações oficiais e comunhão provincial",
        url: "https://facebook.com/arquidiocesebotucatu",
        category: "social",
        iconName: "facebook",
        isExternal: true
      },
      {
        id: "botucatu-provincia",
        title: "Província Eclesiástica de Botucatu",
        subtitle: "Comunhão das Dioceses sufragâneas da região centro-oeste paulista",
        url: "https://arquidiocesebotucatu.org.br/provincia",
        category: "servico",
        iconName: "shield",
        isExternal: true
      }
    ]
  }
};

const normalizeDioceseString = (str: string): string => {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
};

export function getDioceseInfo(
  dioceseKey: string,
  customConfigMap?: Record<string, Partial<DioceseInfo>>
): DioceseInfo {
  const rawKey = (dioceseKey || "MARÍLIA").trim();
  const normalizedKey = rawKey.toUpperCase();
  const plainSearchKey = normalizeDioceseString(rawKey);

  // 1. Look up in default base data
  let baseInfo: DioceseInfo;
  if (DIOCESES_DATA[normalizedKey]) {
    baseInfo = JSON.parse(JSON.stringify(DIOCESES_DATA[normalizedKey]));
  } else {
    // Try exact or accent-folded or partial match in default base data
    const foundKey = Object.keys(DIOCESES_DATA).find((k) => {
      const plainK = normalizeDioceseString(k);
      return (
        k === normalizedKey ||
        plainK === plainSearchKey ||
        plainSearchKey.includes(plainK) ||
        plainK.includes(plainSearchKey)
      );
    });

    if (foundKey && DIOCESES_DATA[foundKey]) {
      baseInfo = JSON.parse(JSON.stringify(DIOCESES_DATA[foundKey]));
      baseInfo.id = normalizedKey;
    } else {
      // Default template for a newly created or generic diocese
      baseInfo = {
        id: normalizedKey,
        name: `Diocese de ${rawKey}`,
        shortName: rawKey,
        type: "Diocese",
        logoUrl: null,
        bishop: {
          name: "Bispo Diocesano",
          title: "Governo Pastoral",
          motto: "In Caritate et Veritate",
          photoUrl: null,
        },
        patron: "Padroeiro Diocesano",
        foundationYear: "",
        pix: {
          key: "",
          keyType: "CNPJ",
          receiverName: `Mitra Diocesana de ${rawKey}`,
          bankName: "",
          city: `${rawKey} - SP`,
          description: "Dízimo e Doações para a Cúria Diocesana"
        },
        curia: {
          address: "Cúria Diocesana",
          neighborhood: "Centro",
          city: rawKey,
          state: "SP",
          cep: "00000-000",
          mapsUrl: `https://www.google.com/maps/search/?api=1&query=Curia+Diocesana+${encodeURIComponent(rawKey)}`,
          phone: "",
          phoneFormatted: "Sob consulta",
          whatsapp: "",
          whatsappFormatted: "",
          email: "curia@dioceses.org.br",
          officeHours: "Segunda a Sexta, das 08h às 11h30 e das 13h às 17h",
        },
        social: {
          website: "",
          instagram: "",
          youtube: "",
          facebook: "",
        },
        links: [
          {
            id: `${normalizedKey.toLowerCase()}-events`,
            title: `Eventos da Diocese de ${rawKey}`,
            subtitle: `Acompanhe os encontros, retiros e formações de ${rawKey}`,
            url: `?event=1&diocese=${encodeURIComponent(rawKey)}`,
            category: "oficial",
            iconName: "calendar",
            highlight: true,
          },
        ],
        coverGradient: "from-sky-700 via-indigo-800 to-slate-950",
        themeColor: "#0284c7",
      };
    }
  }

  // 2. Check if customConfig exists for this diocese
  if (customConfigMap) {
    // Find custom config key (exact, accent-insensitive or partial match)
    const customKey = Object.keys(customConfigMap).find((k) => {
      const plainK = normalizeDioceseString(k);
      return (
        k.toUpperCase().trim() === normalizedKey ||
        plainK === plainSearchKey ||
        plainSearchKey.includes(plainK) ||
        plainK.includes(plainSearchKey)
      );
    });

    if (customKey && customConfigMap[customKey]) {
      const custom = customConfigMap[customKey];
      return {
        ...baseInfo,
        ...custom,
        id: normalizedKey,
        name: custom.name || baseInfo.name,
        shortName: custom.shortName || baseInfo.shortName,
        type: custom.type || baseInfo.type,
        logoUrl: custom.logoUrl !== undefined ? custom.logoUrl : baseInfo.logoUrl,
        logoSize: custom.logoSize !== undefined ? custom.logoSize : baseInfo.logoSize,
        logoBg: custom.logoBg !== undefined ? custom.logoBg : baseInfo.logoBg,
        patron: custom.patron || baseInfo.patron,
        foundationYear: custom.foundationYear !== undefined ? custom.foundationYear : baseInfo.foundationYear,
        coverGradient: custom.coverGradient || baseInfo.coverGradient,
        themeColor: custom.themeColor || baseInfo.themeColor,
        pix: custom.pix ? { ...baseInfo.pix, ...custom.pix } : baseInfo.pix,
        bishop: {
          ...baseInfo.bishop,
          ...(custom.bishop || {}),
          photoSize: custom.bishop?.photoSize !== undefined ? custom.bishop.photoSize : baseInfo.bishop.photoSize,
          photoZoom: custom.bishop?.photoZoom !== undefined ? custom.bishop.photoZoom : baseInfo.bishop.photoZoom,
          emblemSize: custom.bishop?.emblemSize !== undefined ? custom.bishop.emblemSize : baseInfo.bishop.emblemSize,
          emblemBg: custom.bishop?.emblemBg !== undefined ? custom.bishop.emblemBg : baseInfo.bishop.emblemBg,
        },
        curia: {
          ...baseInfo.curia,
          ...(custom.curia || {}),
        },
        social: {
          ...baseInfo.social,
          ...(custom.social || {}),
        },
        links: custom.links && custom.links.length > 0 ? custom.links : baseInfo.links,
        visibility: {
          ...(baseInfo.visibility || {}),
          ...(custom.visibility || {}),
        },
      };
    }
  }

  return baseInfo;
}
