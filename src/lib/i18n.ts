/**
 * LEXORA UI languages: English and Filipino (Taglish — natural Filipino with
 * familiar English tech terms kept where children and teachers actually use
 * them). Reading CONTENT is always Filipino; this only switches the UI.
 */

export const LANG_COOKIE = "lexora_lang";
export type Lang = "en" | "fil";

const en = {
  common: {
    signOut: "Sign out",
    // Shown only when sign-out fails: the cookie is httpOnly, so a failed
    // request means the session is still live and saying nothing would leave
    // the next child on a shared tablet inside this one's account.
    signOutFailed: "Could not sign out — you are still signed in. Check your connection and try again.",
    welcomeBack: "Welcome back",
    levelChip: (l: number, s: number) => `Level ${l} · Marungko stage ${s}`,
    menu: "Menu",
    close: "Close",
    noTts: "Your browser does not support text-to-speech. Please use Microsoft Edge or Google Chrome.",
    noMic: "This browser cannot record audio, so reading aloud is unavailable. Please use a recent version of Chrome, Edge, or Safari.",
  },
  nav: {
    dashboard: "Dashboard",
    reader: "Reader",
    exercises: "Exercises",
    practice: "Practice list",
    reports: "Reports",
    settings: "Settings",
    learners: "Learners",
    cohort: "Cohort",
    wordBank: "Word bank",
  },
  activity: {
    READ_ALOUD: "Read aloud",
    LISTEN_CHOOSE: "Listen & choose",
    BLEND: "Blend the parts",
    SYLLABLES: "Count syllables",
    RHYME: "Rhyme time",
    FIRST_SOUND: "First sound",
    PRACTICE: "Practice list",
    READER: "Reader",
    PSEUDO_PROBE: "Silly words",
  } as Record<string, string>,
  dashboard: {
    // Child-facing copy: short, second person, no percentages. The analytics
    // below keep their own wording — a specialist reads those.
    hello: (name: string) => `Hi, ${name}!`,
    // Spoken without the name: see the note on the dashboard's SpeakButton.
    helloSpoken: "Hi!",
    streak: (n: number) => (n === 1 ? "1 day in a row" : `${n} days in a row`),
    streakNone: "Read some words today to start a streak.",
    bigRead: "Read out loud",
    bigReadSub: "Say the words. LEXORA listens.",
    bigListen: "Listen and follow",
    bigListenSub: "Hear the words read to you.",
    practiseTitle: "Words to practise",
    practiseSub: "A few words to work on. You can do these!",
    practiseEmpty: "Nothing to practise yet — try a Read aloud activity.",
    yourProgress: "Your progress",
    yourProgressSub: "For you and your teacher.",
    overallAccuracy: "Overall accuracy",
    wordsRead: "Words read (14d)",
    minutesPracticed: "Minutes practiced",
    activitiesCompleted: "Activities completed",
    typicalWordTime: "Typical time per word",
    typicalWordTimeEmpty: "—",
    chartTitle: "Accuracy over the last 14 days",
    chartSub: "How reliably you read words correctly.",
    missed: (n: number) => `missed ×${n}`,
    openPractice: "Open practice list →",
    recent: "Recent activity",
    recentEmpty: "Nothing here yet — your finished activities will show up in this list.",
    scoreChip: (c: number, t: number) => `${c}/${t} correct`,
    wordsHeard: (n: number) => `${n} words heard`,
    // Deliberately a count and not a score. Nobody has marked these yet.
    probeReadCount: (n: number) => `${n} read`,
  },
  reader: {
    title: "Reader",
    sub: "Listen and follow along — every word lights up as it is read aloud.",
    chooseSet: "Choose a word set",
    myWords: (l: number) => `My words (Level ${l})`,
    custom: "My own words…",
    readToMe: "Read to me",
    stop: "Stop",
    speed: "Speed",
    smaller: "Smaller text",
    bigger: "Bigger text",
    focusRuler: "Focus ruler",
    displaySettings: "Display settings",
    customPlaceholder: "Type or paste the words you want to practice, e.g. bahay araw aklat…",
    empty: "No words to show yet.",
    tip: "Tip: tap any word to hear it by itself.",
  },
  exercises: {
    title: "Exercises",
    sub: (l: number) => `Word practice tuned to your level — right now you're on Level ${l}.`,
    readAloud: { title: "Read aloud", desc: "Read words out loud — LEXORA listens and checks your reading.", skill: "Single-word decoding" },
    listen: { title: "Listen & choose", desc: "Hear a word and find it among look-alike words.", skill: "Word recognition" },
    blend: { title: "Blend the parts", desc: "Hear a word in parts (pantig) and find the word they make.", skill: "Syllable blending" },
    syllables: { title: "Count the syllables", desc: "Break words into parts (pantig) and count them.", skill: "Segmentation" },
    rhyme: { title: "Rhyme time", desc: "Find words that end with the same sound.", skill: "Rhyming awareness" },
    firstSound: {
      title: "First sound",
      desc: "Find the word that begins with the same sound.",
      skill: "Sound isolation",
    },
    probe: {
      title: "Silly words",
      desc: "Made-up words to sound out. Nobody knows these ones!",
      skill: "Decoding check",
    },
    probeResting: (when: string) => `Resting — you can play this again on ${when}.`,
  },
  session: {
    intro: {
      READ_ALOUD: {
        title: "Read aloud",
        blurb: "Read each word out loud. LEXORA listens and tells you how you did.",
        how: "Press the microphone, then say the word clearly.",
      },
      LISTEN_CHOOSE: {
        title: "Listen & choose",
        blurb: "Listen to the word, then tap the word you heard.",
        how: "Press the speaker any time to hear the word again.",
      },
      BLEND: {
        title: "Blend the parts",
        blurb: "Listen to the parts (pantig) of a word, then put them together. Tap the word they make.",
        how: "Press the speaker any time to hear the parts again.",
      },
      SYLLABLES: {
        title: "Count the syllables",
        blurb: "How many parts (pantig) does the word have?",
        how: "Tap “Hear the parts” to listen to the word piece by piece.",
      },
      RHYME: {
        title: "Rhyme time",
        blurb: "Find the word that rhymes — the one that ends with the same sound.",
        how: "Listen to the big word, then tap its rhyming partner.",
      },
      FIRST_SOUND: {
        title: "First sound",
        blurb: "Listen to the word, then find another word that starts the same way.",
        how: "Say the first sound out loud — /m/ in “mama” — then look for it.",
      },
      PRACTICE: {
        title: "My practice words",
        blurb: "These are your tricky words. Read each one out loud — you've got this!",
        how: "Read a word correctly two times in a row to master it. ⭐",
      },
      // Framed as a game with made-up words rather than as a test. It is a
      // test, and the child will be told so by the adult sitting with them —
      // but nothing is gained by having the app say it in a way that makes a
      // struggling reader tense before they start.
      PSEUDO_PROBE: {
        title: "Silly words",
        blurb: "These words are made up! Nobody knows them. Just sound out the letters.",
        how: "Press the microphone and say the silly word. There is no wrong answer here.",
      },
    } as Record<string, { title: string; blurb: string; how: string }>,
    probeRecorded: "Got it!",
    probeDoneTitle: "All done — nice sounding out!",
    probeDoneBody: (n: number) =>
      `You read ${n} silly words. Your teacher will listen to them later.`,
    start: (n: number) => `Start! (${n} words)`,
    listen: "Listen to this",
    leaveTitle: "Leave this activity?",
    // Deliberately not "your progress will be lost" — it would not be true.
    // Every word is saved as it is read, and the minutes are saved on the way
    // out. What the child gives up is finishing the round.
    leaveBody: "The words you already read are saved. You just will not finish this round.",
    leaveStay: "Keep reading",
    leaveGo: "Leave",
    readWordAloud: "Read this word aloud",
    listening: "Listening… say the word!",
    checking: "Checking…",
    pressMic: "Press the mic, then read the word",
    micAria: "Press and read the word aloud",
    tapWhenDone: "Tap the mic again when you're done",
    scoringUnavailable: "We couldn't hear that clearly. Please check your internet and try again.",
    offline: "We lost the internet connection. Nothing was lost — check the connection, then try the word again.",
    skip: "Skip this word",
    tapHeard: "Tap the word you hear",
    hearAgainAria: "Hear the word again",
    howManyParts: "How many parts (pantig)?",
    hearParts: "Hear the parts",
    whichWordParts: "Which word do the parts make?",
    hearPartsAgainAria: "Hear the parts again",
    whichRhymes: "Which word rhymes with…",
    whichStartsSame: "Which word starts with the same sound as…",
    startsAnswer: (w: string) => `The matching word is ${w}.`,
    correctFeedback: "Magaling! Great job!",
    wrongFeedback: "Not quite — let's learn it!",
    heard: "LEXORA heard:",
    heardNothing: "LEXORA didn't hear the word.",
    rhymeAnswer: (w: string) => `The rhyming word is ${w}.`,
    listenAnswer: (w: string) => `The word was ${w}.`,
    blendAnswer: (w: string) => `The parts make ${w}.`,
    hearItAgain: "Hear it again",
    nowYouTry: "Now you try it!",
    tryItNow: "Say it",
    retryGood: "That's it! Well done.",
    retryKeepGoing: "Good try. We'll practice this word again soon.",
    next: "Next word",
    finish: "Finish",
    stars3: "Amazing!",
    stars1: "Great work!",
    stars0: "Good try!",
    score: (c: number, t: number, p: number) => `You got ${c} out of ${t} words (${p}%).`,
    levelUp: "Level up! Your words just got a little more challenging.",
    playAgain: "Play again",
    moreExercises: "More exercises",
    goDashboard: "Dashboard",
    emptyPractice: "Your practice list is empty — great job! Do a Read aloud exercise to find new words to practice.",
    emptyGeneric: "No items are available yet. Please ask your reading specialist.",
    backToExercises: "Back to exercises",
  },
  practice: {
    title: "Practice list",
    sub: "Your personal list of tricky words. Read a word correctly twice in a row to master it. ⭐",
    practiceNow: "Practice now",
    emptyTitle: "Your practice list is empty!",
    emptySub: "Words you misread in exercises will land here automatically, and your reading specialist can add words too.",
    tryReadAloud: "Try a Read aloud exercise",
    toPractice: (n: number) => `Words to practice (${n})`,
    fromTeacher: "added by your teacher",
    missed: (n: number) => `missed ×${n}`,
    mastered: (n: number) => `Mastered ⭐ (${n})`,
    streakAria: (s: number) => `${s} of 2 correct in a row`,
  },
  /**
   * The specialist workspace.
   *
   * These pages were the one part of LEXORA the language toggle did not reach:
   * pressing FIL changed the learner side and left the specialist side in
   * English, which reads as the toggle being broken rather than as a scoping
   * decision. That matters more than it looks, because the reading specialists
   * are the people who score this app against ISO/IEC 25010 — a control that
   * visibly does not work is something they will rate, and rightly.
   *
   * Filipino here is Taglish, matching the rest of the app: assessment terms a
   * Philippine reading centre already uses in English (accuracy, level, CSV,
   * baseline) stay in English, because translating them would be less clear,
   * not more.
   */
  specialist: {
    welcomeBack: "Welcome back",
    badge: "Reading specialist",
    cohortOverview: "Cohort overview",
    calibration: "Threshold calibration",
    summaryCsv: "Summary CSV",
    allAttemptsCsv: "All attempts CSV",
    allSessionsCsv: "All sessions CSV",
    attemptsCsv: "Attempts CSV",
    sessionsCsv: "Sessions CSV",
    myLearners: (n: number) => `My learners (${n})`,
    noLearners: "No learners yet. Learners appear here as soon as they register.",
    colLearner: "Learner",
    colLevel: "Level",
    colAccuracy: "Accuracy",
    colWordsAttempted: "Words attempted",
    colPracticeWords: "Practice words",
    colLastActive: "Last active",
    never: "never",
    openProgress: (name: string) => `Open ${name}'s progress`,
    allLearners: "All learners",
    interventionControls: "Intervention controls",
    currentPracticeList: "Current practice list",
    pinned: "pinned",
    practiceReviewed: (confirmed: number, overturned: number) =>
      `${confirmed} confirmed · ${overturned} overturned`,
    practiceEvidenceNote:
      "×n is how often the system scored the word as misread. Where you have reviewed those readings, the count you confirmed and the count you overturned follow it — a word whose misreads you mostly overturned may not belong on the list. This is the evidence for checking the list against the words this learner really misreads.",
    difficultyLevel: "Difficulty level",
    addPracticeWord: "Add a practice word",
    typeAWord: "Type a word…",
    add: "Add",
    reliabilityCheck: "Scoring reliability check",
    reliabilitySub: "Replay recorded readings and confirm or dispute the system's scoring.",
    agreementChip: (n: number) => `specialist–system agreement (${n} reviewed)`,
    probeTitle: "Decoding probe (non-words)",
    probeSub:
      "Made-up words cannot be read from memory, so these separate decoding from sight-word recall — the difference between a learner who has learned to decode and one who has learned this word bank. Score them by ear. The recogniser is transcribing words that exist in no language, so it cannot be trusted to spell them; its verdict is shown beside yours for comparison rather than for approval.",
    probeChip: (scored: number, pending: number) =>
      `read correctly (${scored} scored${pending > 0 ? `, ${pending} to review` : ""})`,

    /* ── Skill progression ──────────────────────────────────────────── */
    progressionTitle: "Skill progression",
    progressionSub: (level: number) =>
      `What this learner has to show at level ${level} before moving up — phonological awareness first, then single-word decoding. Moving down depends on decoding alone. You can set the level yourself at any time, above.`,
    progressionPa: "1 · Phonological awareness",
    progressionPaRule: (min: number, pct: number, window: number) =>
      `At least ${min} answers in the listening activities at this level, ${pct}% correct over the latest ${window}.`,
    progressionDecoding: "2 · Single-word decoding",
    progressionDecodingRule: (min: number, pct: number, window: number) =>
      `At least ${min} oral readings at this level, ${pct}% correct over the latest ${window}, and correct readings not getting slower.`,
    progressionTally: (correct: number, answered: number) => `${correct} of ${answered} correct`,
    progressionNone: "Nothing yet at this level",
    progressionMet: "Met",
    progressionNotYet: "Not yet",
    progressionSlowing: "Accurate, but correct readings are getting slower — held at this level for now.",
    progressionAtMax: "Level 5 is the highest level, so there is no further level to move up to.",
    progressionByType: "By activity",

    /* ── Study timeline ─────────────────────────────────────────────── */
    timelineTitle: "Study timeline",
    timelineSub:
      "Optionally, mark which sessions open the testing period (baseline) and which close it (endline). The tag labels the record and is exported as study_phase. It is not a pre/post measure: the study does not measure reading gains.",
    timelineEmpty:
      "No completed sessions yet. They appear here once the learner finishes an activity.",
    phaseSaveFailed: "Could not save that tag.",
    phaseSaveOffline: "No internet connection — the tag was not saved.",
    phaseItems: (n: number) => `${n} items`,

    /* ── Borderline readings ────────────────────────────────────────── */
    borderlineTitle: "Borderline readings",
    borderlineSub: (lower: string, threshold: string) =>
      `Readings that scored between ${lower} and ${threshold} — just below the line for being accepted. Play each one. If the child actually read the word correctly, the system is being too strict.`,
    borderlineThreshold: "current threshold",
    borderlineEmpty:
      "No borderline readings yet. They appear once the learner has recorded readings that fall just short of the threshold — those are the ones worth listening to.",
    borderlineCount: (n: number) => `${n} reading${n === 1 ? "" : "s"} to check`,
    borderlineFeeds: "Every verdict you record here becomes a labelled example.",
    borderlineFeedsLink: "Threshold calibration",
    borderlineFeedsRest:
      "fits the acceptance line to those judgements once enough have been collected across all learners. These borderline readings are the most valuable to review, because they are the only ones whose verdict changes as the line moves.",

    /* ── Re-reads after modelling ───────────────────────────────────── */
    // Not "self-correction": that is a child fixing an error unprompted, and is
    // recorded as an observation on a review. These follow the app saying the word.
    rereadTitle: "Re-reads after hearing the word",
    rereadSub:
      "A missed word, then the same word read again after the child heard it said. Compare the two takes. This is not self-correction — the child had just been told the answer — so these re-reads are kept out of accuracy and the reliability check, and nothing here affects the reported figures.",
    rereadChip: (n: number, total: number) => `right on the re-read (${n} of ${total})`,
    rereadEmpty:
      "Nothing yet. A pair appears here each time the learner misses a word in a read-aloud activity and takes the “Now you try it!” turn that follows.",
    rereadFirst: "First try",
    rereadAfter: "After hearing it",
    rereadNothing: "nothing heard",
    rereadGot: "right the second time",
    rereadStill: "still tricky",

    /* ── Blind review ───────────────────────────────────────────────── */
    blindOn: "Blind review",
    blindOnSub: "the system's verdict is hidden until you decide",
    blindOff: "Quick review",
    blindOffSub: "verdicts recorded now are marked as not blind",
    blindSwitchOff: "Switch to quick review (shows AI verdict first)",
    blindSwitchOn: "Return to blind review",
    blindPromptBefore: "Play the recording, then say whether the learner read",
    blindPromptAfter: "correctly. The system's reading is hidden until you decide.",
    observePrompt: "What did you observe?",
    observeOptional: "optional — skip if unsure",
    heardLabel: "Heard",
    heardNothing: "(nothing)",
    browserHeard: "Browser heard",
    verdictNotSaved: "That verdict was not saved — check the connection and press it again.",
    readIt: "Read it",
    misread: "Misread",
    noReadings:
      "No oral readings recorded yet. Readings appear here after the learner does Read-aloud or Practice exercises.",
    noProbeReadings:
      "No probe readings yet. They appear here after the learner runs the Silly words activity.",

    /* ── Decoding vs recall ─────────────────────────────────────────── */
    divergenceTitle: "Decoding or memorisation?",
    divergenceRealWords: "Real words",
    divergenceRealSub: "From the word bank — can be recognised on sight",
    divergenceProbe: "Probe non-words",
    divergenceProbeSub: "Made up — can only be decoded",
    /* ── Decoding vs recall: body ───────────────────────────────────── */
    divergenceSub:
      "Real words can be read from memory; made-up words cannot. A learner who reads real words far better than non-words is recognising this word bank rather than decoding it — which needs a different intervention, not more of the same practice. Both figures are the specialist's own verdicts, so the two sides are marked the same way.",
    divergenceNotEnough: "Not enough reviewed readings yet",
    divergenceNeeds: (real: number, probe: number, haveReal: number, haveProbe: number) =>
      `Needs ${real} reviewed real words and ${probe} reviewed probe words — one full probe run. So far: ${haveReal} real and ${haveProbe} probe.`,
    divergenceMinNote:
      "The probe minimum is lower than the calibration's 30 on purpose: a run is 8 items behind a 7-day cooldown, so 30 would mean four sittings per child before this could ever be drawn.",
    divergenceGapReal: (n: number) => `Real words ${n} points higher — consistent with sight-word recall`,
    divergenceGapProbe: (n: number) =>
      `Non-words ${n} points higher — unusual; worth listening to both sets`,
    divergenceGapEven: (n: number) =>
      `Within ${n} points — decoding and recall are tracking together`,
    divergenceGapNote:
      "A large gap in favour of real words suggests the word bank has been learned. A small gap suggests the accuracy reflects decoding that should transfer to words the child has not met.",
    divergenceThin: (n: number) =>
      `Fewer than ${n} readings on at least one side. At this size a single item moves the figure by several points, so read the direction rather than the number, and do not quote the gap on its own.`,
    divergenceBlind: (blindReal: number, real: number, blindProbe: number, probe: number) =>
      `Judged blind: ${blindReal}/${real} real words, ${blindProbe}/${probe} probe words.`,
    divergenceAnchored:
      " Verdicts made with the system's answer visible may have been pulled toward it, and the system is more reliable on real words than on non-words — so anchoring could affect the two sides unequally. Worth naming as a limitation.",

    /* ── Baseline to endline: body ──────────────────────────────────── */
    phaseNotEnough: "Not enough tagged readings yet",
    phaseNeeds: (min: number, baseline: number, endline: number) =>
      `Each phase needs ${min} readings before a comparison is drawn. So far: ${baseline} tagged baseline and ${endline} tagged endline.`,
    phaseMissingBoth: " Neither phase has been tagged yet.",
    phaseMissingBaseline: " The baseline is the one still short.",
    phaseMissingEndline: " The endline is the one still short.",
    phaseReadingsHint: (bc: number, bn: number, ec: number, en: number) =>
      `${bc}/${bn} → ${ec}/${en} readings`,
    phaseDecodeHint:
      "Recorded response time, for the specialist — not a measure of reading rate",
    phaseProbeHint: (bc: number, bn: number, ec: number, en: number) =>
      `${bc}/${bn} → ${ec}/${en} scored by ear`,
    phaseProbeNeeds: (min: number, baseline: number, endline: number) =>
      `Needs ${min} reviewed probe readings per phase — one full run (${baseline} and ${endline} so far)`,
    phaseProbeNoteTitle: "Reading the probe row",
    phaseProbeNote:
      "Real words can be learned by sight; made-up words cannot. Real-word accuracy rising while the probe stays flat suggests the child is recognising the word bank rather than decoding it — worth knowing when you plan what to teach next.",
    phaseThin: (n: number) =>
      `Fewer than ${n} readings in at least one phase. Read the direction rather than the size of the change.`,
    phaseDescriptive:
      "A descriptive record for the specialist, not a study outcome. The study does not measure gains in reading (see its Delimitation) and applies no inferential tests, so read these as what the app saw at the start and the end of testing — not as evidence that LEXORA changed anything.",
    phaseUntagged: (n: number) =>
      n === 1
        ? "1 reading is not linked to a session, so it has no phase and is left out of this comparison only. Nothing is wrong with it — the score, the recording and the timing are all there, and it is included in every other figure on this page."
        : `${n} readings are not linked to a session, so they have no phase and are left out of this comparison only. Nothing is wrong with them — the score, the recording and the timing are all there, and they are included in every other figure on this page.`,

    /* ── Baseline to endline ────────────────────────────────────────── */
    phaseTitle: "Start and end of testing",
    phaseSubCohort:
      "Across every learner, comparing the sessions tagged as the baseline with those tagged as the endline.",
    phaseSubLearner:
      "Comparing the sessions tagged as this learner's baseline with those tagged as the endline.",
    phaseTagHint: "Tag sessions in Study timeline below; only tagged sessions can appear here.",
    phaseMeasure: "Measure",
    phaseChange: "Change",
    phaseAccuracy: "Word accuracy",
    phaseDecodeTime: "Time per correct word",
    phaseProbe: "Non-word probe",

    /* ── Word bank ──────────────────────────────────────────────────── */

    /* ── Cohort ─────────────────────────────────────────────────────── */
    cohortSub: (n: number, readings: number) =>
      `All ${n} learners side by side, over ${readings} scored readings. First readings only — re-reads taken after a word was modelled are excluded.`,
    cohortDemoIncluded:
      " Demo learners are included: their reading history is fabricated and must not be reported.",
    cohortDemoExcluded: (n: number) => ` ${n} demo learner${n === 1 ? "" : "s"} excluded.`,
    cohortProgress: "Progress",
    cohortGroupAccuracy: (pct: string) => `group accuracy ${pct}%`,
    cohortReadings: "Readings",
    cohortTopError: "Commonest error",
    cohortCompleted: "Completed",
    cohortMinutes: "Minutes",
    cohortPractice: "Practice / mastered",
    cohortPatternTitle: "Accuracy by syllable pattern",
    cohortPatternSub:
      "A pattern that is weak across every learner is a gap in the teaching, not in the child. Blank means the learner has not met that pattern yet.",
    cohortPattern: "Pattern",
    showDemo: (n: number) => `Show demo data (${n})`,
    hideDemo: (n: number) => `Hide demo data (${n})`,
  },
  reports: {
    title: "My reading report",
    generated: "Generated",
    print: "Print report",
    accuracy14: "Reading accuracy — last 14 days",
    accuracy14Sub: "Daily percentage of words read correctly.",
    byLevel: "Accuracy by difficulty level",
    byLevelSub: "How the learner performs as word structures get harder.",
    byStage: "Accuracy by Marungko stage",
    byStageSub: "Letter-group coverage following the Marungko sequence.",
    byPattern: "Accuracy by syllable structure",
    byPatternSub:
      "Which word shapes the learner decodes reliably, and which need teaching — the most directly actionable view for planning intervention.",
    decodingTime: "How long a correct word takes",
    decodingTimeSub:
      "Decoding effort on single words. Two learners can share the same accuracy while one is still sounding words out and the other recognises them on sight.",
    decodingMedian: (n: number) => `typical time per word, from ${n} correct readings`,
    decodingFaster: (pct: number) => `${pct}% faster than earlier sessions`,
    decodingSlower: (pct: number) => `${pct}% slower than earlier sessions`,
    decodingTimeEmpty: (n: number) =>
      `Needs a few more readings before a reliable figure can be shown (${n} so far).`,
    effortfulWords: "Correct, but still effortful",
    effortfulWordsSub:
      "Read correctly yet noticeably slower than this learner's own pace — likely still being decoded rather than recognised.",
    errors: "Word-level error patterns",
    errorsSub: "What kind of reading errors happen most (all time).",
    recentActivities: "Recent activities",
    noActivities: "No completed activities yet.",
    date: "Date",
    activity: "Activity",
    score: "Score",
    attempts: (n: number) => `${n} attempts`,
    // Display labels only. The export keeps the English family names as values,
    // so an analysis never depends on the interface language.
    errorTypes: {
      substitution: "Substitution",
      omission: "Omission",
      insertion: "Insertion",
      no_response: "No response",
    } as Record<string, string>,
    families: {
      "Open (CV·CV)": "Open (CV·CV)",
      "Closed syllable": "Closed syllable",
      "Vowel pair": "Vowel pair",
      "Consonant cluster": "Consonant cluster",
      "ng words": "ng words",
      "Long (4+ syllables)": "Long (4+ syllables)",
    } as Record<string, string>,
  },
  settingsPage: {
    title: "Display settings",
    sub: "Make reading comfortable for your eyes. Changes apply to the Reader and all exercises.",
    readingFont: "Reading font",
    text: "Text",
    textSize: "Text size",
    letterSpacing: "Letter spacing",
    wordSpacing: "Word spacing",
    lineHeight: "Line height",
    overlay: "Color overlay",
    overlaySub: "A tinted background can reduce visual stress.",
    aids: "Reading aids",
    rulerLabel: "Focus ruler (highlights one line at a time)",
    voiceSpeed: "Reading voice speed",
    testVoice: "Test the voice",
    voiceSample: "Hello! I am LEXORA. Let us read together.",
    preview: "Preview",
    save: "Save settings",
    saving: "Saving…",
    saved: "Saved ✓",
    deviceCheck: "Check this device",
    saveFailed: "Could not save. Check the internet connection and try again — your choices are still on screen.",
  },
  auth: {
    // Shown on the panel beside the form at desktop width.
    panelTitle: "Reading practice that listens.",
    panelSub: "Word-level Filipino reading for learners with dyslexia — built with a reading centre, not for a marketplace.",
    panelPoints: [
      "Words follow the Marungko sequence",
      "A friendly voice reads every word aloud",
      "Progress a reading specialist can act on",
    ],
    signinTitle: "Welcome back!",
    signinSub: "Sign in to continue your reading journey.",
    email: "Email",
    password: "Password",
    signIn: "Sign in",
    signingIn: "Signing in…",
    expired: "Your sign-in has ended. Please sign in again to keep reading.",
    newHere: "New to LEXORA?",
    createAccount: "Create an account",
    registerTitle: "Create your account",
    registerSub: "Reading practice that grows with you.",
    name: "Name (or nickname)",
    passwordHint: "At least 6 characters",
    iAm: "I am a…",
    roleLearner: "Learner",
    roleSpecialist: "Reading specialist",
    accessCode: "Specialist access code",
    accessCodePlaceholder: "Provided by your institution",
    enrolCode: "Enrolment code",
    enrolCodePlaceholder: "From the reading centre, if it gave you one",
    create: "Create account",
    creating: "Creating account…",
    haveAccount: "Already have an account?",
  },
  home: {
    signIn: "Sign in",
    getStarted: "Get started",
    openDash: "Open my dashboard",
    badge: "AI-assisted reading support for persons with dyslexia",
    h1a: "Reading practice that ",
    h1Highlight: "listens",
    h1b: ", cheers, and grows with you",
    sub: "LEXORA helps learners with dyslexia build phonological awareness and single-word decoding in Filipino — with a friendly voice that reads along, an AI ear that checks oral reading, and a dashboard that shows every step of progress.",
    ctaStart: "Start reading free",
    ctaContinue: "Continue reading",
    haveAccount: "I have an account",
    checks: ["Marungko Approach", "Structured Literacy", "No installation needed"],
    mockPrompt: "Read this word aloud",
    mockListening: "Listening… say the word!",
    mockGood: "Magaling! Great job!",
    mockAcc: "accuracy this week",
    eyebrowFeatures: "What it does",
    eyebrowHow: "Three steps",
    featuresTitle: "Everything a young reader needs",
    featuresSub: "Built around two foundational skills: phonological awareness and single-word decoding.",
    features: [
      { title: "Dyslexia-friendly display", desc: "Readable fonts, bigger letter and word spacing, color overlays, and a focus ruler — tuned by each learner." },
      { title: "Read-along voice", desc: "Text-to-speech reads every word aloud with synchronized highlighting and adjustable speed." },
      { title: "AI listens to reading", desc: "A pre-trained speech recognizer checks each word read aloud and gives instant, friendly feedback." },
      { title: "Phonological awareness games", desc: "Rhyming, syllable counting, and listen-and-choose activities that build sound awareness." },
      { title: "Personal practice list", desc: "Misread words are collected automatically so every learner practices exactly what they need." },
      { title: "Progress tracking", desc: "Accuracy trends, error patterns, and printable reports for learners and reading specialists." },
    ],
    howTitle: "How LEXORA works",
    steps: [
      { title: "Read the word aloud", desc: "Words follow the Marungko sequence (m, s, a…) and match the learner's level." },
      { title: "LEXORA listens and helps", desc: "The word is scored instantly. Missed it? Hear it again, see the syllables, try once more." },
      { title: "Practice and grow", desc: "Difficulty adapts automatically, tricky words go to the practice list, and progress is charted." },
    ],
    specTitle: "For reading specialists",
    specDesc: "Monitor every learner's accuracy, error patterns, and practice words. Replay recorded readings, verify the AI's scoring, adjust difficulty, and print progress reports for intervention planning.",
    specCtaOpen: "Open specialist dashboard",
    specCta: "Create a specialist account",
    footerNote: "LEXORA is a reading support tool for word-level practice. It does not diagnose dyslexia and is not a substitute for the professional services of licensed educators, reading specialists, or health-care professionals.",
    privacyLink: "Privacy Notice",
  },
  // The two screens a signed-in child can land on when something fails. They sit
  // inside the app's layout, so they know the child's language like any page.
  fallback: {
    errorTitle: "Something went wrong",
    errorBody: "That page could not load. This is usually a connection problem — please try again.",
    tryAgain: "Try again",
    backToDashboard: "Back to dashboard",
    reference: (digest: string) => `If you need to report this, the reference is ${digest}`,
    notFoundTitle: "We couldn't find that page",
    notFoundBody: "The link may be out of date. Everything else is still here.",
  },
};

export type Dict = typeof en;

const fil: Dict = {
  common: {
    signOut: "Mag-sign out",
    signOutFailed: "Hindi ka na-sign out — naka-sign in ka pa rin. Tingnan ang koneksyon at subukan ulit.",
    welcomeBack: "Kumusta ulit",
    levelChip: (l, s) => `Level ${l} · Marungko stage ${s}`,
    menu: "Menu",
    close: "Isara",
    noTts: "Hindi supported ng browser mo ang text-to-speech. Gumamit ng Microsoft Edge o Google Chrome.",
    noMic: "Hindi makapag-record ang browser na ito, kaya hindi available ang pagbasa nang malakas. Gumamit ng bagong bersyon ng Chrome, Edge, o Safari.",
  },
  nav: {
    dashboard: "Dashboard",
    reader: "Pagbasa",
    exercises: "Mga Ehersisyo",
    practice: "Listahan ng praktis",
    reports: "Mga Ulat",
    settings: "Mga Setting",
    learners: "Mga Mag-aaral",
    cohort: "Kabuuang Grupo",
    wordBank: "Bangko ng Salita",
  },
  activity: {
    READ_ALOUD: "Basahin nang malakas",
    LISTEN_CHOOSE: "Makinig at pumili",
    BLEND: "Pagsamahin ang pantig",
    SYLLABLES: "Bilangin ang pantig",
    RHYME: "Tugmaan",
    FIRST_SOUND: "Unang tunog",
    PRACTICE: "Listahan ng praktis",
    READER: "Pagbasa",
    PSEUDO_PROBE: "Mga salitang imbento",
  },
  dashboard: {
    hello: (name: string) => `Kumusta, ${name}!`,
    helloSpoken: "Kumusta!",
    streak: (n: number) => (n === 1 ? "1 araw na sunod-sunod" : `${n} araw na sunod-sunod`),
    streakNone: "Magbasa ngayon para magsimula ang streak mo.",
    bigRead: "Magbasa nang malakas",
    bigReadSub: "Sabihin ang salita. Nakikinig si LEXORA.",
    bigListen: "Makinig at sumunod",
    bigListenSub: "Pakinggan ang mga salita.",
    practiseTitle: "Mga salitang sasanayin",
    practiseSub: "Kaunting salita lang. Kaya mo ito!",
    practiseEmpty: "Wala pang sasanayin — subukan ang Magbasa nang malakas.",
    yourProgress: "Ang progreso mo",
    yourProgressSub: "Para sa iyo at sa guro mo.",
    overallAccuracy: "Kabuuang accuracy",
    wordsRead: "Salitang nabasa (14 araw)",
    minutesPracticed: "Minutong nag-praktis",
    activitiesCompleted: "Natapos na aktibidad",
    typicalWordTime: "Karaniwang oras kada salita",
    typicalWordTimeEmpty: "—",
    chartTitle: "Accuracy sa nakaraang 14 na araw",
    chartSub: "Gaano katama ang pagbasa mo ng mga salita.",
    missed: (n) => `namali ×${n}`,
    openPractice: "Buksan ang listahan ng praktis →",
    recent: "Mga nakaraang aktibidad",
    recentEmpty: "Wala pa rito — lalabas dito ang mga natapos mong aktibidad.",
    scoreChip: (c, t) => `${c}/${t} tama`,
    wordsHeard: (n) => `${n} salitang napakinggan`,
    probeReadCount: (n) => `${n} nabasa`,
  },
  reader: {
    title: "Pagbasa",
    sub: "Makinig at sumabay — lumiliwanag ang bawat salita habang binabasa.",
    chooseSet: "Pumili ng set ng mga salita",
    myWords: (l) => `Mga salita ko (Level ${l})`,
    custom: "Sariling mga salita…",
    readToMe: "Basahan mo ako",
    stop: "Ihinto",
    speed: "Bilis",
    smaller: "Paliitin ang teksto",
    bigger: "Palakihin ang teksto",
    focusRuler: "Focus ruler",
    displaySettings: "Mga display setting",
    customPlaceholder: "I-type o i-paste ang mga salitang gusto mong i-praktis, hal. bahay araw aklat…",
    empty: "Wala pang salitang maipapakita.",
    tip: "Tip: pindutin ang kahit anong salita para marinig ito nang mag-isa.",
  },
  exercises: {
    title: "Mga Ehersisyo",
    sub: (l) => `Praktis ng mga salitang angkop sa iyo — nasa Level ${l} ka ngayon.`,
    readAloud: { title: "Basahin nang malakas", desc: "Basahin ang mga salita nang malakas — nakikinig at sinusuri ni LEXORA.", skill: "Pagbasa ng salita" },
    listen: { title: "Makinig at pumili", desc: "Pakinggan ang salita at hanapin ito sa magkakahawig na salita.", skill: "Pagkilala ng salita" },
    blend: { title: "Pagsamahin ang pantig", desc: "Pakinggan ang salita nang paisa-isang pantig at hanapin ang salitang nabubuo.", skill: "Pagsasama ng pantig" },
    syllables: { title: "Bilangin ang pantig", desc: "Hatiin ang salita sa mga pantig at bilangin ang mga ito.", skill: "Paghahati ng pantig" },
    rhyme: { title: "Tugmaan", desc: "Hanapin ang mga salitang magkatugma ang dulong tunog.", skill: "Kamalayan sa tugma" },
    firstSound: {
      title: "Unang tunog",
      desc: "Hanapin ang salitang pareho ang unang tunog.",
      skill: "Pagkilala sa tunog",
    },
    probe: {
      title: "Mga salitang imbento",
      desc: "Mga imbentong salita na tutunugin. Walang nakakaalam nito!",
      skill: "Pagsusuri sa pagbasa",
    },
    probeResting: (when) => `Nagpapahinga — mapaglalaruan mo ulit ito sa ${when}.`,
  },
  session: {
    intro: {
      READ_ALOUD: {
        title: "Basahin nang malakas",
        blurb: "Basahin ang bawat salita nang malakas. Nakikinig si LEXORA at sasabihin kung tama ka.",
        how: "Pindutin ang mikropono, tapos sabihin nang malinaw ang salita.",
      },
      LISTEN_CHOOSE: {
        title: "Makinig at pumili",
        blurb: "Pakinggan ang salita, tapos pindutin ang salitang narinig mo.",
        how: "Pindutin ang speaker kahit kailan para marinig ulit ang salita.",
      },
      BLEND: {
        title: "Pagsamahin ang pantig",
        blurb: "Pakinggan ang mga pantig ng salita, tapos pagsamahin mo. Pindutin ang salitang nabubuo.",
        how: "Pindutin ang speaker kahit kailan para marinig ulit ang mga pantig.",
      },
      SYLLABLES: {
        title: "Bilangin ang pantig",
        blurb: "Ilang pantig mayroon ang salita?",
        how: "Pindutin ang “Pakinggan ang mga pantig” para marinig ito nang paisa-isa.",
      },
      RHYME: {
        title: "Tugmaan",
        blurb: "Hanapin ang salitang katugma — 'yung pareho ang dulong tunog.",
        how: "Pakinggan ang malaking salita, tapos pindutin ang katugma nito.",
      },
      FIRST_SOUND: {
        title: "Unang tunog",
        blurb: "Pakinggan ang salita, tapos hanapin ang salitang pareho ang unang tunog.",
        how: "Sabihin ang unang tunog — /m/ sa “mama” — tapos hanapin ito.",
      },
      PRACTICE: {
        title: "Mga praktis na salita ko",
        blurb: "Ito ang mga mahirap mong salita. Basahin ang bawat isa nang malakas — kaya mo 'yan!",
        how: "Basahin nang tama ang salita nang dalawang sunod para ma-master ito. ⭐",
      },
      PSEUDO_PROBE: {
        title: "Mga salitang imbento",
        blurb: "Imbento lang ang mga salitang ito! Walang nakakaalam nito. Tunugin mo lang ang mga letra.",
        how: "Pindutin ang mikropono at sabihin ang salitang imbento. Walang maling sagot dito.",
      },
    },
    probeRecorded: "Nakuha na!",
    probeDoneTitle: "Tapos na — magaling ang pagtunog mo!",
    probeDoneBody: (n) =>
      `Nakabasa ka ng ${n} salitang imbento. Pakikinggan ito ng guro mo mamaya.`,
    start: (n) => `Simulan! (${n} salita)`,
    listen: "Pakinggan ito",
    leaveTitle: "Aalis ka na ba?",
    leaveBody: "Naka-save na ang mga salitang nabasa mo. Hindi mo lang matatapos ang round na ito.",
    leaveStay: "Magpatuloy",
    leaveGo: "Umalis",
    readWordAloud: "Basahin nang malakas ang salitang ito",
    listening: "Nakikinig… sabihin ang salita!",
    checking: "Sinusuri…",
    pressMic: "Pindutin ang mic, tapos basahin ang salita",
    micAria: "Pindutin at basahin ang salita nang malakas",
    tapWhenDone: "Pindutin ulit ang mic kapag tapos ka na",
    scoringUnavailable: "Hindi namin narinig nang malinaw. Pakicheck ang internet at subukan ulit.",
    offline: "Nawala ang internet. Walang nawala sa iyong ginawa — pakicheck ang koneksyon, tapos subukan ulit ang salita.",
    skip: "Laktawan ang salitang ito",
    tapHeard: "Pindutin ang salitang narinig mo",
    hearAgainAria: "Pakinggan ulit ang salita",
    howManyParts: "Ilang pantig?",
    hearParts: "Pakinggan ang mga pantig",
    whichWordParts: "Anong salita ang nabubuo ng mga pantig?",
    hearPartsAgainAria: "Pakinggan ulit ang mga pantig",
    whichRhymes: "Aling salita ang katugma ng…",
    whichStartsSame: "Aling salita ang pareho ang unang tunog ng…",
    startsAnswer: (w) => `Ang tamang salita ay ${w}.`,
    correctFeedback: "Magaling! Ang galing mo!",
    wrongFeedback: "Hindi pa tama — aralin natin!",
    heard: "Narinig ni LEXORA:",
    heardNothing: "Hindi narinig ni LEXORA ang salita.",
    rhymeAnswer: (w) => `Ang katugmang salita ay ${w}.`,
    listenAnswer: (w) => `Ang salita ay ${w}.`,
    blendAnswer: (w) => `Ang nabubuong salita ay ${w}.`,
    hearItAgain: "Pakinggan ulit",
    nowYouTry: "Ngayon, subukan mo!",
    tryItNow: "Basahin mo",
    retryGood: "Ayan! Magaling ka.",
    retryKeepGoing: "Magandang subok. Babalikan natin ang salitang ito.",
    next: "Susunod na salita",
    finish: "Tapusin",
    stars3: "Galing-galing!",
    stars1: "Mahusay!",
    stars0: "Magandang subok!",
    score: (c, t, p) => `Nakuha mo ang ${c} sa ${t} salita (${p}%).`,
    levelUp: "Level up! Medyo mas hamon na ang mga salita mo.",
    playAgain: "Ulitin",
    moreExercises: "Iba pang ehersisyo",
    goDashboard: "Dashboard",
    emptyPractice: "Walang laman ang listahan ng praktis mo — magaling! Subukan ang Basahin nang malakas para makahanap ng bagong salitang praktisin.",
    emptyGeneric: "Wala pang laman. Magtanong sa iyong reading specialist.",
    backToExercises: "Balik sa mga ehersisyo",
  },
  practice: {
    title: "Listahan ng praktis",
    sub: "Ang personal mong listahan ng mahihirap na salita. Basahin nang tama nang dalawang sunod para ma-master. ⭐",
    practiceNow: "Mag-praktis na",
    emptyTitle: "Walang laman ang listahan mo!",
    emptySub: "Awtomatikong mapupunta rito ang mga salitang namali mo sa ehersisyo, at puwede ring magdagdag ang iyong reading specialist.",
    tryReadAloud: "Subukan ang Basahin nang malakas",
    toPractice: (n) => `Mga salitang dapat praktisin (${n})`,
    fromTeacher: "idinagdag ng guro mo",
    missed: (n) => `namali ×${n}`,
    mastered: (n) => `Na-master ⭐ (${n})`,
    streakAria: (s) => `${s} sa 2 na sunod na tama`,
  },
  specialist: {
    welcomeBack: "Kumusta ulit",
    badge: "Reading specialist",
    cohortOverview: "Pangkalahatang tanaw ng cohort",
    calibration: "Pag-calibrate ng threshold",
    summaryCsv: "Summary CSV",
    allAttemptsCsv: "Lahat ng attempts CSV",
    allSessionsCsv: "Lahat ng sessions CSV",
    attemptsCsv: "Attempts CSV",
    sessionsCsv: "Sessions CSV",
    myLearners: (n) => `Mga mag-aaral ko (${n})`,
    noLearners: "Wala pang mag-aaral. Lilitaw sila rito kapag nakapag-register na sila.",
    colLearner: "Mag-aaral",
    colLevel: "Level",
    colAccuracy: "Accuracy",
    colWordsAttempted: "Salitang sinubukan",
    colPracticeWords: "Salitang pinapraktis",
    colLastActive: "Huling aktibo",
    never: "wala pa",
    openProgress: (name) => `Buksan ang progreso ni ${name}`,
    allLearners: "Lahat ng mag-aaral",
    interventionControls: "Mga kontrol sa interbensyon",
    currentPracticeList: "Kasalukuyang listahan ng praktis",
    pinned: "naka-pin",
    practiceReviewed: (confirmed, overturned) =>
      `${confirmed} kinumpirma · ${overturned} binaliktad`,
    practiceEvidenceNote:
      "Ang ×n ay kung ilang beses itinuring ng sistema na mali ang pagbasa ng salita. Kung nasuri mo na ang mga pagbasang iyon, kasunod nito ang bilang na kinumpirma mo at ang binaliktad mo — ang salitang karamihan ng mali ay binaliktad mo ay maaaring hindi dapat nasa listahan. Ito ang ebidensya sa pagsusuri kung tugma ang listahan sa mga salitang talagang nababasa nang mali ng mag-aaral.",
    difficultyLevel: "Antas ng hirap",
    addPracticeWord: "Magdagdag ng salitang praktis",
    typeAWord: "Mag-type ng salita…",
    add: "Idagdag",
    reliabilityCheck: "Pagsusuri sa pagiging maaasahan ng scoring",
    reliabilitySub:
      "Pakinggang muli ang mga naitalang pagbasa at kumpirmahin o tutulan ang scoring ng sistema.",
    agreementChip: (n) => `pagkakasundo ng specialist at sistema (${n} nasuri)`,
    probeTitle: "Pagsusuri sa pagdedekowd (mga salitang imbento)",
    probeSub:
      "Hindi puwedeng basahin sa memorya ang mga imbentong salita, kaya inihihiwalay nito ang pagdedekowd sa pagkilala ng salitang kabisado — ang pagkakaiba ng mag-aaral na natutong magdekowd at ng natutong kabisaduhin ang word bank na ito. Suriin ito sa pamamagitan ng pakikinig. Nagta-transcribe ang recogniser ng mga salitang wala sa kahit anong wika, kaya hindi ito maaasahang baybayin ang mga ito; ipinapakita ang hatol nito sa tabi ng sa iyo para paghambingan, hindi para sang-ayunan.",
    probeChip: (scored, pending) =>
      `tamang nabasa (${scored} nasuri${pending > 0 ? `, ${pending} pang susuriin` : ""})`,

    progressionTitle: "Pag-usad ng kasanayan",
    progressionSub: (level) =>
      `Ang kailangang maipakita ng mag-aaral sa level ${level} bago umakyat — kamalayang ponolohikal muna, saka pagbasa ng isang salita. Ang pagbaba ay batay lamang sa pagbasa. Maaari mong itakda ang level anumang oras, sa itaas.`,
    progressionPa: "1 · Kamalayang ponolohikal",
    progressionPaRule: (min, pct, window) =>
      `Hindi bababa sa ${min} sagot sa mga gawaing pakikinig sa level na ito, ${pct}% tama sa huling ${window}.`,
    progressionDecoding: "2 · Pagbasa ng isang salita",
    progressionDecodingRule: (min, pct, window) =>
      `Hindi bababa sa ${min} pagbasa nang malakas sa level na ito, ${pct}% tama sa huling ${window}, at hindi bumabagal ang mga tamang pagbasa.`,
    progressionTally: (correct, answered) => `${correct} sa ${answered} ang tama`,
    progressionNone: "Wala pa sa level na ito",
    progressionMet: "Naabot na",
    progressionNotYet: "Hindi pa",
    progressionSlowing: "Tama, pero bumabagal ang mga tamang pagbasa — mananatili muna sa level na ito.",
    progressionAtMax: "Ang level 5 ang pinakamataas, kaya wala nang susunod na level.",
    progressionByType: "Ayon sa gawain",

    timelineTitle: "Timeline ng pag-aaral",
    timelineSub:
      "Kung nais, markahan kung aling mga session ang nagbubukas ng panahon ng pagsubok (baseline) at alin ang nagsasara nito (endline). Tatak ito sa talaan at kasama sa export bilang study_phase. Hindi ito sukatang pre/post: hindi sinusukat ng pag-aaral ang pag-unlad sa pagbasa.",
    timelineEmpty:
      "Wala pang natapos na session. Lilitaw sila rito kapag may natapos nang aktibidad ang mag-aaral.",
    phaseSaveFailed: "Hindi na-save ang tag na iyon.",
    phaseSaveOffline: "Walang koneksyon — hindi na-save ang tag.",
    phaseItems: (n) => `${n} aytem`,

    borderlineTitle: "Mga borderline na pagbasa",
    borderlineSub: (lower, threshold) =>
      `Mga pagbasang nakakuha ng ${lower} hanggang ${threshold} — bahagyang kulang para tanggapin. Pakinggan ang bawat isa. Kung tama namang nabasa ng bata ang salita, masyadong mahigpit ang sistema.`,
    borderlineThreshold: "kasalukuyang threshold",
    borderlineEmpty:
      "Wala pang borderline na pagbasa. Lilitaw ang mga ito kapag may naitalang pagbasang bahagyang kulang sa threshold — iyon ang sulit pakinggan.",
    borderlineCount: (n) => `${n} pagbasa ang susuriin`,
    borderlineFeeds: "Bawat hatol na itinatala mo rito ay nagiging labelled na halimbawa.",
    borderlineFeedsLink: "Pag-calibrate ng threshold",
    borderlineFeedsRest:
      "ang mag-aakma ng linya ng pagtanggap sa mga hatol na iyon kapag sapat na ang naipon mula sa lahat ng mag-aaral. Ang mga borderline na pagbasa ang pinakamahalagang suriin, dahil sila lang ang nagbabago ng hatol habang gumagalaw ang linya.",

    rereadTitle: "Muling pagbasa matapos marinig ang salita",
    rereadSub:
      "Isang salitang namali, at ang muling pagbasa nito matapos marinig ng bata ang tamang bigkas. Paghambingin ang dalawa. Hindi ito kusang pagtatama — narinig na ng bata ang sagot — kaya hindi ito kasama sa accuracy at sa pagsusuri ng scoring, at walang epekto ito sa mga iniuulat na bilang.",
    rereadChip: (n, total) => `tama sa muling pagbasa (${n} sa ${total})`,
    rereadEmpty:
      "Wala pa. Lilitaw rito ang isang pares tuwing mamamali ang mag-aaral sa isang salita sa Basahin nang malakas at gagawin ang kasunod na “Ngayon, subukan mo!”.",
    rereadFirst: "Unang subok",
    rereadAfter: "Matapos marinig",
    rereadNothing: "walang narinig",
    rereadGot: "tama sa ikalawa",
    rereadStill: "mahirap pa rin",

    blindOn: "Blind review",
    blindOnSub: "nakatago ang hatol ng sistema hanggang magdesisyon ka",
    blindOff: "Mabilisang review",
    blindOffSub: "ang mga hatol ngayon ay markadong hindi blind",
    blindSwitchOff: "Lumipat sa mabilisang review (makikita muna ang hatol ng AI)",
    blindSwitchOn: "Bumalik sa blind review",
    blindPromptBefore: "Pakinggan ang recording, tapos sabihin kung tama bang nabasa ng mag-aaral ang",
    blindPromptAfter: "— nakatago ang pagbasa ng sistema hanggang magdesisyon ka.",
    observePrompt: "Ano ang napansin mo?",
    observeOptional: "opsyonal — laktawan kung hindi sigurado",
    heardLabel: "Narinig",
    heardNothing: "(wala)",
    browserHeard: "Narinig ng browser",
    verdictNotSaved: "Hindi na-save ang hatol na iyon — tingnan ang koneksyon at pindutin ulit.",
    readIt: "Nabasa",
    misread: "Namali",
    noReadings:
      "Wala pang naitalang pagbasa nang malakas. Lilitaw sila rito matapos ang Basahin nang malakas o Praktis.",
    noProbeReadings:
      "Wala pang probe na pagbasa. Lilitaw sila rito matapos gawin ng mag-aaral ang Mga salitang imbento.",

    divergenceTitle: "Pagdedekowd ba o pagkabisado?",
    divergenceRealWords: "Tunay na salita",
    divergenceRealSub: "Mula sa word bank — puwedeng makilala agad",
    divergenceProbe: "Mga salitang imbento",
    divergenceProbeSub: "Imbento — kailangang tunugin",
    divergenceSub:
      "Puwedeng basahin sa memorya ang tunay na salita; hindi ang salitang imbento. Kapag mas mahusay na nababasa ng mag-aaral ang tunay na salita kaysa sa imbento, kinikilala niya ang word bank na ito sa halip na dinedekowd — at ibang interbensyon ang kailangan doon, hindi dagdag na parehong praktis. Parehong hatol ng specialist ang dalawang bilang, kaya pareho ang paraan ng pagmamarka sa dalawa.",
    divergenceNotEnough: "Kulang pa ang nasuring pagbasa",
    divergenceNeeds: (real, probe, haveReal, haveProbe) =>
      `Kailangan ng ${real} nasuring tunay na salita at ${probe} nasuring probe na salita — isang buong probe run. Sa ngayon: ${haveReal} tunay at ${haveProbe} probe.`,
    divergenceMinNote:
      "Sinadyang mas mababa ang minimum ng probe kaysa sa 30 ng calibration: 8 aytem ang isang run at may 7-araw na pahinga, kaya ang 30 ay mangangahulugang apat na upuan bawat bata bago ito maipakita.",
    divergenceGapReal: (n) =>
      `Mas mataas ng ${n} puntos ang tunay na salita — tugma sa pagkilala ng kabisadong salita`,
    divergenceGapProbe: (n) =>
      `Mas mataas ng ${n} puntos ang salitang imbento — hindi karaniwan; sulit pakinggan ang dalawang set`,
    divergenceGapEven: (n) =>
      `Hanggang ${n} puntos lang ang agwat — magkasabay ang pagdedekowd at ang pagkabisado`,
    divergenceGapNote:
      "Kapag malaki ang agwat pabor sa tunay na salita, malamang natutunan na ang word bank. Kapag maliit, malamang pagdedekowd ang nasa likod ng accuracy, at dapat itong magamit din sa mga salitang hindi pa nakikita ng bata.",
    divergenceThin: (n) =>
      `Kulang sa ${n} na pagbasa sa kahit isang panig. Sa ganitong laki, ilang puntos ang galaw ng bilang sa iisang aytem, kaya basahin ang direksyon at hindi ang laki, at huwag banggitin ang agwat nang mag-isa.`,
    divergenceBlind: (blindReal, real, blindProbe, probe) =>
      `Hatol na blind: ${blindReal}/${real} tunay na salita, ${blindProbe}/${probe} probe na salita.`,
    divergenceAnchored:
      " Maaaring nahila papunta sa sagot ng sistema ang mga hatol na ginawa habang nakikita ito, at mas maaasahan ang sistema sa tunay na salita kaysa sa imbento — kaya maaaring hindi pantay ang epekto ng anchoring sa dalawang panig. Sulit itong banggitin bilang limitasyon.",

    phaseNotEnough: "Kulang pa ang naka-tag na pagbasa",
    phaseNeeds: (min, baseline, endline) =>
      `Kailangan ng ${min} pagbasa sa bawat phase bago maghambing. Sa ngayon: ${baseline} naka-tag na baseline at ${endline} naka-tag na endline.`,
    phaseMissingBoth: " Wala pang phase na naka-tag.",
    phaseMissingBaseline: " Ang baseline ang kulang pa.",
    phaseMissingEndline: " Ang endline ang kulang pa.",
    phaseReadingsHint: (bc, bn, ec, en) => `${bc}/${bn} → ${ec}/${en} na pagbasa`,
    phaseDecodeHint:
      "Naitalang oras ng pagsagot, para sa espesyalista — hindi sukatan ng bilis ng pagbasa",
    phaseProbeHint: (bc, bn, ec, en) => `${bc}/${bn} → ${ec}/${en} na sinuri sa pakikinig`,
    phaseProbeNeeds: (min, baseline, endline) =>
      `Kailangan ng ${min} nasuring probe na pagbasa sa bawat phase — isang buong run (${baseline} at ${endline} sa ngayon)`,
    phaseProbeNoteTitle: "Pagbasa sa hanay ng probe",
    phaseProbeNote:
      "Puwedeng makilala sa paningin ang tunay na salita; hindi ang salitang imbento. Kapag tumataas ang accuracy sa tunay na salita habang patag ang probe, malamang kinikilala ng bata ang word bank sa halip na dinedekowd ito — mahalagang malaman ito sa pagpaplano ng susunod na ituturo.",
    phaseThin: (n) =>
      `Kulang sa ${n} na pagbasa sa kahit isang phase. Basahin ang direksyon, hindi ang laki ng pagbabago.`,
    phaseDescriptive:
      "Deskriptibong talaan para sa espesyalista, hindi resulta ng pag-aaral. Hindi sinusukat ng pag-aaral ang pag-unlad sa pagbasa (tingnan ang Delimitation nito) at walang inferential test, kaya basahin ang mga ito bilang nakita ng app sa simula at sa dulo ng pagsubok — hindi bilang ebidensya na may binago ang LEXORA.",
    phaseUntagged: (n) =>
      n === 1
        ? "1 pagbasa ang hindi naka-link sa isang session, kaya wala itong phase at hindi lang kasama sa paghahambing na ito. Walang problema rito — kumpleto ang score, ang recording at ang oras, at kasama ito sa lahat ng iba pang bilang sa page na ito."
        : `${n} pagbasa ang hindi naka-link sa isang session, kaya wala silang phase at hindi lang sila kasama sa paghahambing na ito. Walang problema sa kanila — kumpleto ang score, ang recording at ang oras, at kasama sila sa lahat ng iba pang bilang sa page na ito.`,

    phaseTitle: "Simula at dulo ng pagsubok",
    phaseSubCohort:
      "Sa lahat ng mag-aaral, inihahambing ang mga session na naka-tag na baseline sa mga naka-tag na endline.",
    phaseSubLearner:
      "Inihahambing ang mga session na naka-tag bilang baseline ng mag-aaral na ito sa mga naka-tag na endline.",
    phaseTagHint:
      "I-tag ang mga session sa Timeline ng pag-aaral sa ibaba; naka-tag na session lang ang lilitaw dito.",
    phaseMeasure: "Sukatan",
    phaseChange: "Pagbabago",
    phaseAccuracy: "Accuracy sa salita",
    phaseDecodeTime: "Oras kada tamang salita",
    phaseProbe: "Probe na salitang imbento",


    cohortSub: (n, readings) =>
      `Magkakatabi ang lahat ng ${n} mag-aaral, mula sa ${readings} na na-score na pagbasa. Unang pagbasa lamang — hindi kasama ang muling pagbasa matapos marinig ang salita.`,
    cohortDemoIncluded:
      " Kasama ang mga demo learner: imbento ang kanilang kasaysayan sa pagbasa at hindi ito dapat iulat.",
    cohortDemoExcluded: (n) => ` Hindi kasama ang ${n} demo learner.`,
    cohortProgress: "Progreso",
    cohortGroupAccuracy: (pct) => `accuracy ng grupo ${pct}%`,
    cohortReadings: "Pagbasa",
    cohortTopError: "Pinakamadalas na mali",
    cohortCompleted: "Natapos",
    cohortMinutes: "Minuto",
    cohortPractice: "Praktis / na-master",
    cohortPatternTitle: "Accuracy ayon sa istruktura ng pantig",
    cohortPatternSub:
      "Kapag mahina ang isang istruktura sa lahat ng mag-aaral, puwang ito sa pagtuturo, hindi sa bata. Walang laman kung hindi pa ito nasusubukan ng mag-aaral.",
    cohortPattern: "Istruktura",
    showDemo: (n) => `Ipakita ang demo data (${n})`,
    hideDemo: (n) => `Itago ang demo data (${n})`,
  },
  reports: {
    title: "Ulat ng pagbasa ko",
    generated: "Ginawa noong",
    print: "I-print ang ulat",
    accuracy14: "Accuracy sa pagbasa — nakaraang 14 na araw",
    accuracy14Sub: "Arawang porsyento ng mga salitang nabasa nang tama.",
    byLevel: "Accuracy ayon sa difficulty level",
    byLevelSub: "Kung paano bumabasa ang mag-aaral habang humihirap ang mga salita.",
    byStage: "Accuracy ayon sa Marungko stage",
    byStageSub: "Saklaw ng mga letra ayon sa Marungko sequence.",
    byPattern: "Accuracy ayon sa istruktura ng pantig",
    byPatternSub:
      "Kung aling hugis ng salita ang tiyak nang nababasa ng mag-aaral, at alin ang kailangan pang ituro.",
    decodingTime: "Gaano katagal bago mabasa nang tama",
    decodingTimeSub:
      "Hirap sa pagbasa ng isang salita. Maaaring pareho ang accuracy ng dalawang mag-aaral pero ang isa ay pinapantig pa rin habang ang isa ay agad nang nakikilala ang salita.",
    decodingMedian: (n) => `karaniwang oras kada salita, mula sa ${n} tamang pagbasa`,
    decodingFaster: (pct) => `${pct}% mas mabilis kaysa dati`,
    decodingSlower: (pct) => `${pct}% mas mabagal kaysa dati`,
    decodingTimeEmpty: (n) =>
      `Kailangan pa ng ilang pagbasa bago maipakita ang tiyak na bilang (${n} pa lang).`,
    effortfulWords: "Tama, pero mahirap pa rin",
    effortfulWordsSub:
      "Nabasa nang tama pero mas mabagal kaysa sa karaniwang bilis ng mag-aaral — malamang pinapantig pa rin.",
    errors: "Mga uri ng pagkakamali sa salita",
    errorsSub: "Anong klaseng pagkakamali sa pagbasa ang madalas (lahat ng panahon).",
    recentActivities: "Mga nakaraang aktibidad",
    noActivities: "Wala pang natapos na aktibidad.",
    date: "Petsa",
    activity: "Aktibidad",
    score: "Iskor",
    attempts: (n) => `${n} pagsubok`,
    errorTypes: {
      substitution: "Napalitan",
      omission: "May nawala",
      insertion: "May nadagdag",
      no_response: "Walang sagot",
    },
    families: {
      "Open (CV·CV)": "Bukas na pantig (KP·KP)",
      "Closed syllable": "Saradong pantig",
      "Vowel pair": "Magkasunod na patinig",
      "Consonant cluster": "Magkasunod na katinig",
      "ng words": "Mga salitang may ng",
      "Long (4+ syllables)": "Mahaba (4+ pantig)",
    },
  },
  settingsPage: {
    title: "Mga Display Setting",
    sub: "Gawing komportable ang pagbasa para sa mga mata mo. Gagana ito sa Pagbasa at sa lahat ng ehersisyo.",
    readingFont: "Font sa pagbasa",
    text: "Teksto",
    textSize: "Laki ng teksto",
    letterSpacing: "Espasyo ng mga letra",
    wordSpacing: "Espasyo ng mga salita",
    lineHeight: "Taas ng linya",
    overlay: "Kulay ng background",
    overlaySub: "Ang may kulay na background ay nakakabawas ng hirap sa mata.",
    aids: "Tulong sa pagbasa",
    rulerLabel: "Focus ruler (isang linya lang ang naka-highlight)",
    voiceSpeed: "Bilis ng boses sa pagbasa",
    testVoice: "Subukan ang boses",
    voiceSample: "Kumusta! Ako si LEXORA. Sabay tayong magbasa.",
    preview: "Preview",
    save: "I-save ang mga setting",
    saving: "Sine-save…",
    saved: "Na-save ✓",
    deviceCheck: "Suriin ang device na ito",
    saveFailed: "Hindi na-save. Pakicheck ang internet at subukan ulit — nandiyan pa ang mga pinili mo.",
  },
  auth: {
    panelTitle: "Pagbasang marunong makinig.",
    panelSub: "Pagbasa ng salitang Filipino para sa mga may dyslexia — ginawa kasama ang isang reading centre.",
    panelPoints: [
      "Sumusunod sa Marungko sequence ang mga salita",
      "May magiliw na boses na bumabasa ng bawat salita",
      "Progresong kayang gamitin ng reading specialist",
    ],
    signinTitle: "Maligayang pagbabalik!",
    signinSub: "Mag-sign in para ituloy ang iyong pagbasa.",
    email: "Email",
    password: "Password",
    signIn: "Mag-sign in",
    signingIn: "Nagsa-sign in…",
    expired: "Natapos na ang iyong sign-in. Mag-sign in ulit para makapagbasa.",
    newHere: "Bago sa LEXORA?",
    createAccount: "Gumawa ng account",
    registerTitle: "Gumawa ng account",
    registerSub: "Praktis sa pagbasa na sumasabay sa iyo.",
    name: "Pangalan (o palayaw)",
    passwordHint: "Hindi bababa sa 6 na karakter",
    iAm: "Ako ay…",
    roleLearner: "Mag-aaral",
    roleSpecialist: "Reading specialist",
    accessCode: "Access code ng specialist",
    accessCodePlaceholder: "Mula sa inyong institusyon",
    enrolCode: "Enrolment code",
    enrolCodePlaceholder: "Mula sa reading centre, kung binigyan ka",
    create: "Gumawa ng account",
    creating: "Ginagawa ang account…",
    haveAccount: "May account ka na?",
  },
  home: {
    signIn: "Mag-sign in",
    getStarted: "Magsimula",
    openDash: "Buksan ang dashboard ko",
    badge: "AI-assisted na suporta sa pagbasa para sa mga may dyslexia",
    h1a: "Praktis sa pagbasa na ",
    h1Highlight: "nakikinig",
    h1b: ", nagche-cheer, at sumasabay sa'yo",
    sub: "Tinutulungan ng LEXORA ang mga mag-aaral na may dyslexia na paunlarin ang phonological awareness at pagbasa ng salita sa Filipino — may boses na sumasabay sa pagbasa, AI na nakikinig sa iyong pagbasa nang malakas, at dashboard na nagpapakita ng bawat hakbang ng iyong progreso.",
    ctaStart: "Simulan ang pagbasa — libre",
    ctaContinue: "Ituloy ang pagbasa",
    haveAccount: "May account na ako",
    checks: ["Marungko Approach", "Structured Literacy", "Walang kailangang i-install"],
    mockPrompt: "Basahin nang malakas ang salitang ito",
    mockListening: "Nakikinig… sabihin ang salita!",
    mockGood: "Magaling! Ang galing mo!",
    mockAcc: "accuracy ngayong linggo",
    eyebrowFeatures: "Ano ang ginagawa nito",
    eyebrowHow: "Tatlong hakbang",
    featuresTitle: "Lahat ng kailangan ng batang mambabasa",
    featuresSub: "Nakatuon sa dalawang pundasyong kasanayan: phonological awareness at pagbasa ng salita.",
    features: [
      { title: "Display na para sa may dyslexia", desc: "Madaling basahing font, mas maluwag na espasyo ng letra at salita, kulay na background, at focus ruler — ayon sa gusto ng mag-aaral." },
      { title: "Boses na sumasabay", desc: "Binabasa ng text-to-speech ang bawat salita nang may sabay na highlight at adjustable na bilis." },
      { title: "AI na nakikinig sa pagbasa", desc: "Sinusuri ng pre-trained na speech recognizer ang bawat salitang binasa at agad na nagbibigay ng feedback." },
      { title: "Mga larong pantunog", desc: "Tugmaan, pagbilang ng pantig, at makinig-at-pumili na mga aktibidad para sa kamalayan sa tunog." },
      { title: "Personal na listahan ng praktis", desc: "Awtomatikong naiipon ang mga namaling salita para praktisin mismo ang kailangan ng mag-aaral." },
      { title: "Pagsubaybay sa progreso", desc: "Trend ng accuracy, mga uri ng pagkakamali, at napi-print na ulat para sa mag-aaral at reading specialist." },
    ],
    howTitle: "Paano gumagana ang LEXORA",
    steps: [
      { title: "Basahin ang salita nang malakas", desc: "Sumusunod ang mga salita sa Marungko sequence (m, s, a…) at akma sa level ng mag-aaral." },
      { title: "Nakikinig at tumutulong si LEXORA", desc: "Agad na sinusuri ang salita. Namali? Pakinggan ulit, tingnan ang mga pantig, subukan muli." },
      { title: "Mag-praktis at lumago", desc: "Awtomatikong umaangkop ang hirap, napupunta sa listahan ng praktis ang mahihirap na salita, at naitatala ang progreso." },
    ],
    specTitle: "Para sa mga reading specialist",
    specDesc: "Subaybayan ang accuracy, mga uri ng pagkakamali, at mga praktis na salita ng bawat mag-aaral. I-replay ang mga naitalang pagbasa, i-verify ang pagsusuri ng AI, ayusin ang difficulty, at i-print ang mga ulat para sa intervention planning.",
    specCtaOpen: "Buksan ang specialist dashboard",
    specCta: "Gumawa ng specialist account",
    footerNote: "Ang LEXORA ay kasangkapang pansuporta sa pagbasa ng salita. Hindi ito nagdadayagnos ng dyslexia at hindi kapalit ng serbisyo ng mga lisensyadong guro, reading specialist, o propesyonal sa kalusugan.",
    privacyLink: "Paunawa sa Privacy",
  },
  fallback: {
    errorTitle: "Nagkaproblema",
    errorBody: "Hindi ma-load ang page na ito. Kadalasan, problema ito sa koneksyon — pakisubukan ulit.",
    tryAgain: "Subukan ulit",
    backToDashboard: "Balik sa dashboard",
    reference: (digest) => `Kung kailangan mo itong i-report, ang reference ay ${digest}`,
    notFoundTitle: "Hindi namin makita ang page na iyon",
    notFoundBody: "Maaaring luma na ang link. Nandito pa rin ang lahat ng iba.",
  },
};

const dicts: Record<Lang, Dict> = { en, fil };

export function getDict(lang: Lang): Dict {
  return dicts[lang] ?? en;
}

export function normalizeLang(value: string | undefined | null): Lang {
  return value === "fil" ? "fil" : "en";
}
