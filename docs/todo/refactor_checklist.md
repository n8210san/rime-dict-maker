Refactor Verification Checklist (scripts/)

Goal
- Build a complete, prioritized checklist to verify all refactored or newly introduced functions across the scripts/ directory, ensuring parity with original behavior and safe integrations.

Legend
- Priority: High / Medium / Low
- Risk: High / Medium / Low
- Check Items: Params, Logic, Return, Edge cases / Compatibility

1) Range/Dictionary Filtering

1.1 Function: buildRangeFilter
- Original: scripts/dictMaker.js (pre-refactor)
- New: scripts/rangeFilter.js → RangeFilter.buildRangeFilter (also global.buildRangeFilter)
- Check Items:
  - Params: accepts string range (">N", ">=N", "<N", "<=N", "A-B", "N") – whitespace tolerant.
  - Logic: correct operator mapping; A-B order-insensitive; single number equals; non-numeric rejects; throws with helpful message.
  - Return: returns predicate function (x:number)→boolean; deterministic.
  - Edge: empty string; malformed ("=>3", "3-", "a-b"); very large values; unicode/locale digits not supported.
  - Compatibility: Ensure any legacy callers expecting global.buildRangeFilter still work.
- Risk: Medium (central input validation; affects filtering correctness)
- Priority: High

1.2 Function: streamFilterDict
- Original: scripts/dictMaker.js (pre-refactor)
- New: scripts/rangeFilter.js → RangeFilter.streamFilterDict (also global.streamFilterDict)
- Check Items:
  - Params: (rangeStr, onProgress?) where onProgress({percent, processed, matched}) optional.
  - Logic: streaming via ReadableStream when available; fallback to resp.text() path; invokes buildRangeFilter; applies char length filter via getCharLengthFilter(); sorts by frequency desc; stable behavior across both code paths.
  - Return: resolved string (joined by \n) with lines formatted "word freq code"; consistent between paths.
  - Edge: missing/invalid Content-Length; unknown encoding select; lines with <3 parts; non-numeric frequencies; trailing partial line remainder; very large files; CRLF vs LF; empty results.
  - Compatibility: Depends on global getCharLengthFilter() existing on pages using it (dictMaker defines it; others may not) – ensure guarded use or polyfill; legacy_compatibility.js warning behavior.
- Risk: High (I/O heavy, cross-file dependency on getCharLengthFilter, user-facing correctness)
- Priority: High

2) Cangjie processing

2.1 Class: CangjieProcessor.loadCangjieDict
- Original: scripts/utils.js (legacy loader) and/or dictMaker.js pre-refactor
- New: scripts/cangjieProcessor.js (Map-based implementation)
- Check Items:
  - Params: none; async; cached Map; clearCache() resets.
  - Logic: fetch data/cangjie5.dict.yaml, skip comments/headers; split by whitespace; builds Map<char, codes>.
  - Return: Map instance; empty Map on failure (not throwing); logs message.
  - Edge: malformed YAML layout; lines with tabs; multiple codes per line; duplicates (last-wins) vs legacy behavior; encoding.
  - Compatibility: legacy utils.js uses Object mapping; verify all downstream users (FcjUtils.cjMakeFromText, commonCangjie.js, cangjieIntegration.js) can accept Map or need wrapper; ensure global.loadCangjieDict wrapper returns identical shape expected by callers.
- Risk: Medium (data shape change Map vs Object may break assumptions)
- Priority: High

2.2 Method: CangjieProcessor.pickQuick
- Original: scripts/utils.js and other integration files
- New: scripts/cangjieProcessor.js; also exposed via global.pickQuick
- Check Items:
  - Params: codeStr possibly with spaces (multiple codes) → uses first token.
  - Logic: n=1 return 1st; n>=2 return first+last; empty returns ''.
  - Return: string.
  - Edge: codeStr with extra spaces/tabs; non-alpha; mixed-case; multiple codes; empty/undefined.
  - Compatibility: multiple duplicate implementations exist (utils.js, commonCangjie.js, cangjieIntegration.js, extracted_features.js) – ensure single source of truth or equality; consolidate tests.
- Risk: Low-Medium (simple logic but duplication increases drift risk)
- Priority: Medium

2.3 Method: CangjieProcessor.pickFCJ
- Original: scripts/utils.js and other integration files
- New: scripts/cangjieProcessor.js; also exposed via global.pickFCJ
- Check Items:
  - Params: codeStr; reads first token.
  - Logic: n=1→orig; n=2→orig; n>=3→left2+right1; empty→''.
  - Return: string.
  - Edge: same as pickQuick.
  - Compatibility: same duplication concerns; verify behavior parity with pages expecting FCJ.
- Risk: Low-Medium
- Priority: Medium

2.4 Method: CangjieProcessor.processCode/processText (new wrapper/utility)
- Original: N/A (new)
- New: scripts/cangjieProcessor.js
- Check Items:
  - Params: processCode(codeStr, mode=fcj); processText(text, mode=fcj) splitting into chars.
  - Logic: correct mode switching; uses loadCangjieDict; returns per-char array with original vs processed.
  - Return: stable structures; suitable for UI.
  - Edge: chars not in map; surrogate pairs; punctuation; performance on long strings.
- Risk: Low
- Priority: Low

2.5 Global wrappers for compatibility
- Original: global functions previously defined in utils.js/commonCangjie.js
- New: scripts/cangjieProcessor.js defines global.loadCangjieDict, global.pickQuick, global.pickFCJ; also duplicates in cangjieIntegration.js, commonCangjie.js, extracted_features.js
- Check Items:
  - Conflicts: ensure only one set takes effect; no circular overrides; order of inclusion in HTML.
  - Back-compat: pages relying on global functions continue to work.
  - Action: decide authoritative source; remove duplicates or alias to the same instance.
- Risk: Medium (order-dependent bugs)
- Priority: High

3) Words pipeline refactor

3.1 Function: prepare
- Original: scripts/words.js (older implementation without detailed char-length filtering and tail-number support)
- New: scripts/words.js (expanded with langFiltering, dedupWithTailNumber, unified char filter)
- Check Items:
  - Params: (returnType, regex) where returnType can include 'dedup', '[]', '+num'/' +count', 'charFilter'; regex optional.
  - Logic: 
    - getSourceText(); langFiltering() with optional keep_tail_num; 
    - split to tokens; conditional dedup (with/without tail count aggregation); 
    - char-length filtering via getUnifiedCharLengthFilter() including 1,2,3,4,5+ options; treat non-Chinese tokens using token length vs Chinese-length.
  - Return: returns array when '[]' included; else string joined with \n.
  - Edge: lines with trailing counts; mixed CJK and Latin; empty source; very long text; regex=' ' bypass; localStorage config interactions.
  - Compatibility: downstream calls expecting previous behavior; ensure buttons that use prepare('dedup') or prepare('[]') still produce expected results.
- Risk: Medium-High (central text pipeline; broader surface)
- Priority: High

3.2 New helpers in words.js: langFiltering, dedupWithTailNumber, getUnifiedCharLengthFilter, doFreeCj wrapper
- Original: N/A or spread across utils.js; behavior changed
- New: scripts/words.js
- Check Items:
  - langFiltering: dynamic pattern by #langFilterSelect; JP/KR ranges; ensure regex construction correctness; keep_tail_num negative lookahead correctness; performance.
  - dedupWithTailNumber: aggregation correctness; lines without tail numbers counted as 1; formatting when count>1; idempotency.
  - getUnifiedCharLengthFilter: fallback to new CharLengthOptions.getFilter; ensure robust when component absent; mapping of 5+.
  - doFreeCj: wrapper to FcjUtils.cjMakeFromText injecting charLengthFilter; ensure options passthrough; maintain previous API.
- Risk: Medium
- Priority: Medium

4) Utils refactor and mode toggling

4.1 FcjUtils.cjMakeFromText (legacy simplified)
- Original: more complex/centralized logic possibly in utils.js or modules/*
- New: scripts/utils.js simplified implementation; also module-based variant may exist in scripts/modules/
- Check Items:
  - Params: (text, mode='fcj', opts={ append3AtEnd, charLengthFilter, showCount, separator })
  - Logic: builds from legacy loadCangjieDict; quick vs fcj paths; dedup (seen/seenFCJ); charLengthFilter gating; ignores append3AtEnd currently? (verify usage); output formatting.
  - Return: string lines "han code"; newline-joined.
  - Edge: phrases with mixed chars; missing codes; performance; order determinism.
  - Compatibility: callers in dictMaker.js runMake(), normalizeDictionary(), words.js doFreeCj rely on this; ensure consistent.
- Risk: Medium
- Priority: High

4.2 loadCompatibilityLayer / ModuleSystem detection (intelligent mode toggling)
- Original: N/A; previously no such branch or different mechanism
- New: scripts/utils.js checks ModuleSystem and early-returns after loading a compatibility layer
- Check Items:
  - Logic: If ModuleSystem exists, redefine global setters through modern UI module; provide minimal FcjUtils; side effects order with DOM ready; ensure pages without ModuleSystem keep legacy behavior.
  - Edge: partial ModuleSystem presence; race conditions; double-binding events; duplicate global.pickQuick/pickFCJ defined elsewhere.
  - Compatibility: validate both words*.html and dictMaker*.html pages in both modes.
- Risk: Medium-High (global behavior switch)
- Priority: High

4.3 Global functions in utils.js (setOutput/setInput/setIO/etc.)
- Original: older utils.js
- New: updated behaviors, e.g., pushUndo messaging combines #langFilterSelect and opts; applyChange grouping by op
- Check Items:
  - Params/Logic: ensure undo grouping works; not over-pushing; correct target when swapping or moving next step.
  - Return/Side effects: status label updates; not breaking UI.
  - Edge: missing DOM elements on certain pages.
- Risk: Medium
- Priority: Medium

5) DictMaker refactor touchpoints

5.1 getCharLengthFilter (dictMaker-specific)
- Original: embedded or implicit
- New: scripts/dictMaker.js defines page-specific filter; used by streamFilterDict indirectly (global) and runMake
- Check Items:
  - Logic: checkbox ids (#fcjOpt_singleChar, #fcjOpt_2char, ...); fallback when element absent; mapping for 5+.
  - Compatibility: ensure RangeFilter.streamFilterDict relying on global getCharLengthFilter has this defined in dictMaker context; other pages should not break.
- Risk: Medium
- Priority: High

5.2 runMake (dictMaker-specific) – updated to call FcjUtils.cjMakeFromText
- Original: may have inlined logic
- New: uses FcjUtils.cjMakeFromText with options (append3AtEnd, charLengthFilter, showCount, separator)
- Check Items:
  - Params: mode quick/fcj; option wiring; separator handling with \t; count toggling.
  - Compatibility: output count and meta updates; errors handled via catch.
- Risk: Medium
- Priority: Medium

5.3 normalizeDictionary / dedupeWithComments / performDeduplication (reworked)
- Original: older versions
- New: revised, more efficient implementations
- Check Items:
  - Logic: correctness across formats (word count, root word count, root word, etc.); stable ordering; comment/empty line preservation; sum counts; needsNormalization detection; separator handling.
  - Edge: huge files; non-ASCII words; duplicate entries many times.
- Risk: Medium
- Priority: Medium

6) Duplicated Cangjie utilities across files
- Locations: scripts/utils.js, scripts/cangjieProcessor.js, scripts/commonCangjie.js, scripts/cangjieIntegration.js, scripts/extracted_features.js
- Check Items:
  - Ensure consistent pickQuick/pickFCJ behavior; remove or alias duplicates; unify globals; confirm which file is loaded by each HTML and in what order.
  - Create single-source-of-truth unit tests or shared import.
- Risk: High (drift/override issues)
- Priority: High

7) Legacy compatibility and globals
- File: scripts/legacy_compatibility.js
- Check Items:
  - Emits warnings if buildRangeFilter undefined; now provided by rangeFilter.js – ensure rangeFilter.js is included on pages that use it.
  - Verify no missing globals after refactor (getCharLengthFilter, pickQuick/FCJ, FcjUtils).
- Risk: Medium
- Priority: Medium

Actionable Tasks (Ordered)
1. Audit HTML includes order for all pages (words*.html, dictMaker*.html, dictMaker_v2*.html) to ensure correct global resolution (High priority, High risk areas: globals, duplicates).
2. Write parity tests for buildRangeFilter with diverse inputs, and for streamFilterDict using a small fixture (simulate both streaming and fallback) (High priority).
3. Validate getCharLengthFilter availability in contexts where streamFilterDict is called; if absent, provide internal fallback in rangeFilter.js or safe-guard (High priority).
4. Consolidate pickQuick/pickFCJ: select authoritative implementation (prefer CangjieProcessor) and export/alias from others; remove redundant global reassignments (High priority).
5. Verify utils.js ModuleSystem toggle: test in both modes; ensure no double-binding and globals are correct (High priority).
6. Verify words.js prepare end-to-end flows: dedup, [] return, char filters, tail-number, language filter modes (High priority).
7. Verify FcjUtils.cjMakeFromText outputs for both quick/fcj; ensure append3AtEnd honored or clarify deprecation (Medium priority).
8. Validate dictMaker normalization/dedup flows on multiple input formats and large inputs (Medium priority).
9. Check legacy_compatibility warnings do not appear in normal operation (Medium priority).
10. Create regression tests/fixtures and document expected outputs (Medium priority).

Deliverables
- Test results and parity notes per function/group
- Fix PRs to unify duplicates and patch missing fallbacks
- Documentation updates for developers (loading order, globals)
