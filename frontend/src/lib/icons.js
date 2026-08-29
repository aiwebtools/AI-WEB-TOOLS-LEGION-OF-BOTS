import {
  Cog, BookOpen, Clapperboard, PenTool, Code, Search, Atom, Sprout, Leaf,
  Briefcase, HeartPulse, Palette, Wrench, Sparkles, Bot, Zap, Brain,
} from "lucide-react";

const MAP = {
  Cog, BookOpen, Clapperboard, PenTool, Code, Search, Atom, Sprout, Leaf,
  Briefcase, HeartPulse, Palette, Wrench, Sparkles, Bot, Zap, Brain,
};

export function iconFor(name) {
  return MAP[name] || Bot;
}
