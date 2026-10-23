// Translations per language: English text → translated text. Missing
// entries fall back to English. Generated files live in ./messages/*.json
// (see scripts/i18n-*.mjs); keep keys exactly as written in the code.
import ar from "./messages/ar.json";
import de from "./messages/de.json";
import es from "./messages/es.json";
import fr from "./messages/fr.json";
import hi from "./messages/hi.json";
import id from "./messages/id.json";
import it from "./messages/it.json";
import ja from "./messages/ja.json";
import ko from "./messages/ko.json";
import nl from "./messages/nl.json";
import pl from "./messages/pl.json";
import ptBR from "./messages/pt-BR.json";
import ru from "./messages/ru.json";
import tr from "./messages/tr.json";
import vi from "./messages/vi.json";
import zhHans from "./messages/zh-Hans.json";

export const MESSAGES: Record<string, Record<string, string>> = {
  ar, de, es, fr, hi, id, it, ja, ko, nl, pl, "pt-BR": ptBR, ru, tr, vi, "zh-Hans": zhHans,
};
