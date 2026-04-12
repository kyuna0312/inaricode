import { useEffect, useMemo, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { filterFuzzySorted } from "../fuzzy/match.js";

const WIN = 14;

export function PickTui(props: {
  items: string[];
  title: string;
  onChoose: (line: string) => void;
  onCancel: () => void;
}) {
  const { exit } = useApp();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);

  const filtered = useMemo(() => {
    const f = filterFuzzySorted(q, props.items, 20_000);
    return f.length > 0 ? f : props.items.slice(0, Math.min(500, props.items.length));
  }, [q, props.items]);

  useEffect(() => {
    setIdx((i) => (filtered.length === 0 ? 0 : Math.min(i, filtered.length - 1)));
  }, [filtered.length, q]);

  const start = useMemo(() => {
    if (filtered.length <= WIN) return 0;
    const half = Math.floor(WIN / 2);
    return Math.max(0, Math.min(idx - half, filtered.length - WIN));
  }, [filtered.length, idx]);

  const windowed = useMemo(() => filtered.slice(start, start + WIN), [filtered, start]);

  useInput((input, key) => {
    if (key.escape) {
      props.onCancel();
      exit();
      return;
    }
    if (key.return) {
      const sel = filtered[idx];
      if (sel) props.onChoose(sel);
      exit();
      return;
    }
    if (key.upArrow) {
      setIdx((i) => Math.max(0, i - 1));
      return;
    }
    if (key.downArrow) {
      setIdx((i) => Math.min(filtered.length - 1, i + 1));
      return;
    }
    if (key.backspace || key.delete) {
      setQ((x) => x.slice(0, -1));
      return;
    }
    if (input && input.length === 1 && !key.ctrl && !key.meta) {
      setQ((x) => x + input);
    }
  });

  return (
    <Box flexDirection="column">
      <Text dimColor>{props.title}</Text>
      <Text bold color="cyan">
        › {q}
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {windowed.map((line, i) => {
          const globalIdx = start + i;
          const active = globalIdx === idx;
          return (
            <Text key={`${globalIdx}-${line}`} bold={active} color={active ? "green" : undefined} dimColor={!active}>
              {active ? "▶ " : "  "}
              {line}
            </Text>
          );
        })}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>↑↓ Enter · Esc · filter as you type (fuzzy)</Text>
      </Box>
    </Box>
  );
}
