import { memo, useCallback } from "react";
import {
  getTafsirDisplayName,
  hasBundledTafsirContent,
  type TafsirCatalogItem,
  type TafsirLanguage,
} from "@/lib/tafsirCatalog";

type TafsirSourceTileProps = {
  item: TafsirCatalogItem;
  index: number;
  sectionOffset: number;
  selectedLanguage: TafsirLanguage;
  isRTL: boolean;
  noContentLabel: string;
  onOpenItemSubpage: (item: TafsirCatalogItem) => void;
};

export const TafsirSourceTile = memo(function TafsirSourceTile({
  item,
  index,
  sectionOffset,
  selectedLanguage,
  isRTL,
  noContentLabel,
  onOpenItemSubpage,
}: TafsirSourceTileProps) {
  const bundled = hasBundledTafsirContent(item, selectedLanguage);
  const handleOpen = useCallback(() => {
    onOpenItemSubpage(item);
  }, [item, onOpenItemSubpage]);

  return (
    <button
      key={item.id}
      onClick={handleOpen}
      className={`pp-tafsir-item w-full rounded-xl px-4 py-3 border relative overflow-hidden backdrop-blur-sm hover:scale-[1.01] active:scale-[0.99] transition-all animate-fade-in-up text-center ${
        bundled ? "pp-tafsir-item-bundled" : "pp-tafsir-item-unbundled"
      }`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/35 pointer-events-none rounded-xl" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
      <div className={`relative z-10 flex items-center gap-3`}>
        <div className="pp-tafsir-item-index w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-bold text-sm flex-shrink-0">
          {sectionOffset + index + 1}
        </div>
        <div className="flex-1 min-w-0 flex items-center justify-center">
          <div className="pp-tafsir-item-title font-semibold text-base break-words text-center leading-snug pp-text-primary">
            {getTafsirDisplayName(item, selectedLanguage)}
          </div>
        </div>
        <div className="w-8 flex-shrink-0 opacity-0" aria-hidden="true" />
      </div>
      {!bundled && (
        <p className="text-sm mt-1 pp-text-secondary mx-auto px-4 text-center relative z-10">
          {noContentLabel}
        </p>
      )}
    </button>
  );
});