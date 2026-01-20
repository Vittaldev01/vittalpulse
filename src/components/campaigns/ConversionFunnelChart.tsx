interface ConversionFunnelChartProps {
  stats: {
    total: number;
    respondedM1: number;
    respondedM2: number;
  };
}

interface FunnelStageData {
  percentage: string;
  color: string;
  title: string;
  value: string;
  description: string;
  widthPercent: number;
}

function TrapezoidFunnel({ stages }: { stages: FunnelStageData[] }) {
  const SVG_WIDTH = 280;
  const SVG_HEIGHT = 340;
  const STAGE_HEIGHT = 100;
  const SPACING = 20;
  
  // Calcular larguras proporcionais para cada trapézio
  const maxWidth = SVG_WIDTH * 0.95;
  const stage1Width = maxWidth;
  const stage2Width = maxWidth * (stages[1].widthPercent / 100);
  const stage3Width = maxWidth * (stages[2].widthPercent / 100) * 0.85;
  
  return (
    <svg width={SVG_WIDTH} height={SVG_HEIGHT} viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="drop-shadow-sm">
      {/* Trapézio 1 - Total de Leads (Azul) */}
      <polygon
        points={`
          ${(SVG_WIDTH - stage1Width) / 2},0
          ${(SVG_WIDTH + stage1Width) / 2},0
          ${(SVG_WIDTH + stage2Width) / 2},${STAGE_HEIGHT}
          ${(SVG_WIDTH - stage2Width) / 2},${STAGE_HEIGHT}
        `}
        fill={stages[0].color}
        className="transition-all duration-500"
      />
      
      {/* Trapézio 2 - Responderam M1 (Verde) */}
      <polygon
        points={`
          ${(SVG_WIDTH - stage2Width) / 2},${STAGE_HEIGHT + SPACING}
          ${(SVG_WIDTH + stage2Width) / 2},${STAGE_HEIGHT + SPACING}
          ${(SVG_WIDTH + stage3Width) / 2},${STAGE_HEIGHT * 2 + SPACING}
          ${(SVG_WIDTH - stage3Width) / 2},${STAGE_HEIGHT * 2 + SPACING}
        `}
        fill={stages[1].color}
        className="transition-all duration-500"
      />
      
      {/* Trapézio 3 - Responderam M2 (Roxo) */}
      <polygon
        points={`
          ${(SVG_WIDTH - stage3Width) / 2},${STAGE_HEIGHT * 2 + SPACING * 2}
          ${(SVG_WIDTH + stage3Width) / 2},${STAGE_HEIGHT * 2 + SPACING * 2}
          ${(SVG_WIDTH + stage3Width * 0.6) / 2},${SVG_HEIGHT}
          ${(SVG_WIDTH - stage3Width * 0.6) / 2},${SVG_HEIGHT}
        `}
        fill={stages[2].color}
        className="transition-all duration-500"
      />
    </svg>
  );
}

interface FunnelStageRowProps {
  percentage: string;
  title: string;
  value: string;
  description: string;
  topOffset: number;
}

function FunnelStageRow({ 
  percentage, 
  title, 
  value, 
  description,
  topOffset
}: FunnelStageRowProps) {
  return (
    <div 
      className="absolute left-0 right-0 flex items-center gap-4"
      style={{ top: `${topOffset}px` }}
    >
      {/* Coluna Esquerda: Porcentagem */}
      <div className="w-24 text-right flex-shrink-0">
        <span className="text-4xl font-bold text-foreground">{percentage}</span>
      </div>
      
      {/* Espaço para o funil SVG */}
      <div className="w-[280px] flex-shrink-0" />
      
      {/* Linha conectora pontilhada */}
      <div className="w-8 border-t-2 border-dotted border-muted-foreground/30" />
      
      {/* Coluna Direita: Título e Descrição */}
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-foreground text-base">{title}</h4>
        <p className="text-sm text-muted-foreground">
          {value} • {description}
        </p>
      </div>
    </div>
  );
}

export function ConversionFunnelChart({ stats }: ConversionFunnelChartProps) {
  const conversionM1ToTotal = stats.total > 0 ? (stats.respondedM1 / stats.total) * 100 : 0;
  const conversionM2ToM1 = stats.respondedM1 > 0 ? (stats.respondedM2 / stats.respondedM1) * 100 : 0;

  const funnelData: FunnelStageData[] = [
    {
      percentage: "100%",
      color: "hsl(210, 100%, 70%)",
      title: "Total de Leads",
      value: `${stats.total} leads`,
      description: "Base total da campanha",
      widthPercent: 100
    },
    {
      percentage: `${Math.round(conversionM1ToTotal)}%`,
      color: "hsl(142, 71%, 65%)",
      title: "Responderam M1",
      value: `${stats.respondedM1} leads`,
      description: `${conversionM1ToTotal.toFixed(1)}% do total`,
      widthPercent: conversionM1ToTotal
    },
    {
      percentage: `${Math.round(conversionM2ToM1)}%`,
      color: "hsl(271, 71%, 65%)",
      title: "Responderam M2",
      value: `${stats.respondedM2} leads`,
      description: `${conversionM2ToM1.toFixed(1)}% de M1`,
      widthPercent: conversionM2ToM1
    }
  ];

  // Posições verticais para alinhar textos com os trapézios
  const rowPositions = [35, 155, 275];

  if (stats.total === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        Aguardando dados de interação
      </div>
    );
  }

  return (
    <div className="py-8 px-8 max-w-4xl mx-auto">
      <div className="relative" style={{ height: '380px' }}>
        {/* SVG do funil centralizado */}
        <div className="absolute" style={{ left: '96px', top: '0' }}>
          <TrapezoidFunnel stages={funnelData} />
        </div>
        
        {/* Linhas de texto com porcentagens e descrições */}
        {funnelData.map((item, index) => (
          <FunnelStageRow
            key={index}
            percentage={item.percentage}
            title={item.title}
            value={item.value}
            description={item.description}
            topOffset={rowPositions[index]}
          />
        ))}
      </div>
    </div>
  );
}
