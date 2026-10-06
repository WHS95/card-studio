import type { Template } from "../fields";
import { magazine } from "./magazine";
import { intro } from "./intro";
import { interview } from "./interview";
import { news } from "./news";
import { poster } from "./poster";
import { reel } from "./reel";

export const TEMPLATES: Template[] = [magazine, intro, interview, news, poster, reel];
export const templateOf = (id: string) => TEMPLATES.find((t) => t.id === id) ?? magazine;
