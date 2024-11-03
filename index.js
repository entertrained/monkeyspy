const $form = document.getElementById("form")
const $username = document.getElementById("username")
const $main = document.querySelector("main")
let difficulty = "all" // 'normal' | 'expert' | 'master'

const tests = [
  ["time", "15"],
  ["time", "30"],
  ["time", "60"],
  ["time", "120"],
  ["words", "10"],
  ["words", "25"],
  ["words", "50"],
  ["words", "100"],
]

const wordlists = ["english", "english_1k", "english_5k", "english_10k"]

const settings = [
  { punctuation: false, numbers: false },
  { punctuation: true, numbers: false },
  { punctuation: true, numbers: true },
]

const MS_IN_SECOND = 1000
const MS_IN_MINUTE = MS_IN_SECOND * 60
const MS_IN_HOUR = MS_IN_MINUTE * 60
const MS_IN_DAY = MS_IN_HOUR * 24

const formatNum = (num) => new Intl.NumberFormat("en-US", {}).format(num)
const formatPercent = (num) =>
  new Intl.NumberFormat("en-US", { style: "percent" }).format(num)

const formatTimeAgo = (ms) => {
  const d = Math.floor(ms / MS_IN_DAY)

  return `<strong>${d}</strong> day${d !== 1 ? "s" : ""}  ago`
}

const getDurationChunk = (num, unit, html) => {
  return html
    ? `<strong>${num}</strong> ${unit}${num === 1 ? "" : "s"}`
    : `${num} ${unit}${num === 1 ? "" : "s"}`
}

const formatDuration = (ms, html = true) => {
  const d = Math.floor(ms / MS_IN_DAY)
  const h = Math.floor((ms - MS_IN_DAY * d) / MS_IN_HOUR)
  const m = Math.floor((ms - MS_IN_DAY * d - MS_IN_HOUR * h) / MS_IN_MINUTE)

  const parts = []

  if (d > 0) {
    parts.push(getDurationChunk(d, "day", html))
  }

  if (d > 0 || h > 0) {
    parts.push(getDurationChunk(h, "hour", html))
  }

  parts.push(getDurationChunk(m, "minute", html))

  return parts.join(" ")
}

async function fetchMonkeytypeProfile(username) {
  const res = await fetch(
    `https://api.monkeytype.com/users/${username}/profile`,
  )

  if (!res.ok) {
    if (res.status === 429) {
      return [null, "Reached Monkeytype request limit, please try again later."]
    }

    if (res.status === 404) {
      return [null, "User doesn't exist."]
    }

    return [null, "Connot fetch the data."]
  }

  return [(await res.json()).data, null]
}

async function loadUserStats(username) {
  if (!username) {
    return
  }

  const [data, err] = await fetchMonkeytypeProfile(username)

  if (err) {
    $main.innerHTML = `<p class="bad">${err}</p>`
    return
  }

  const items = []

  for (const wordlist of wordlists) {
    for (const [type, mode] of tests) {
      for (const { difficulty, punctuation, numbers } of settings) {
        const entries = data.personalBests?.[type]?.[mode]
        const statsNormal = entries?.find(
          (x) =>
            x.language === wordlist &&
            x.difficulty === "normal" &&
            x.punctuation === punctuation &&
            Boolean(x.numbers) === numbers,
        )

        const statsExpert = entries?.find(
          (x) =>
            x.language === wordlist &&
            x.difficulty === "expert" &&
            x.punctuation === punctuation &&
            Boolean(x.numbers) === numbers,
        )

        const statsMaster = entries?.find(
          (x) =>
            x.language === wordlist &&
            x.difficulty === "master" &&
            x.punctuation === punctuation &&
            Boolean(x.numbers) === numbers,
        )

        const maxWpm = Math.max(
          statsNormal?.wpm ?? 0,
          statsExpert?.wpm ?? 0,
          statsMaster?.wpm ?? 0,
        )

        const stats =
          difficulty === "normal"
            ? statsNormal
            : difficulty === "expert"
              ? statsExpert
              : difficulty === "master"
                ? statsMaster
                : [statsNormal, statsExpert, statsMaster].find(
                    (x) => (x?.wpm ?? 0) === maxWpm,
                  )

        items.push({
          type,
          mode,
          wordlist,
          difficulty,
          punctuation,
          numbers,
          stats: stats
            ? {
                acc: stats.acc,
                con: stats.consistency,
                wpm: stats.wpm,
                timestamp: stats.timestamp,
              }
            : null,
        })
      }
    }
  }

  const timeSpent = formatDuration(data?.typingStats?.timeTyping * 1000 ?? 0)
  const completedTests = formatNum(data?.typingStats?.completedTests ?? 0)
  const startedTests = formatNum(data?.typingStats?.startedTests ?? 0)
  const percentCompleted = formatPercent(
    data?.typingStats?.startedTests
      ? (data?.typingStats?.completedTests ?? 0) /
          (data?.typingStats?.startedTests ?? 0)
      : 0,
  )

  const $general = `<div class="general">
    <p>Joined ${formatTimeAgo(Date.now() - data.addedAt)}</p>
    <p class="time">Typed for ${timeSpent}</p>
    <p>Completed <strong>${completedTests}</strong> of <strong>${startedTests}</strong> tests (<strong>${percentCompleted}</strong>).</p>
  </div>`

  const $items = items
    .map((item) => {
      const settings = [
        ...[!item.punctuation && !item.numbers ? "lowercase" : undefined],
        ...[item.punctuation ? "punctuation" : undefined],
        ...[item.numbers ? "numbers" : undefined],
      ]
        .filter(Boolean)
        .join(", ")

      const ms = item?.stats?.timestamp
        ? Date.now() - item.stats.timestamp
        : Infinity
      const ago = ms !== Infinity ? formatTimeAgo(ms) : "long time ago"
      const opacity = 0.6 + Math.exp(-(ms / (MS_IN_DAY * 365))) * 0.4

      const $stats = item.stats
        ? `<div class="stats">
            <p class="wpm" title="Words Per Minute"><strong>${item.stats.wpm}</strong></p>
            <p class="acc ${
              item.stats.acc >= 98 ? "ok" : item.stats.acc >= 95 ? "meh" : "bad"
            }" title="Accuracy">${item.stats.acc}%</p>
            <p class="ago">${ago}</p>
          </div>`
        : `<div class="stats">
            <p class="wpm" title="Words Per Minute"><strong>-</strong></p>
            <p class="acc" title="Accuracy">-</p>
            <p class="ago">never</p>
          </div>`

      return `<li style="opacity: ${opacity}">
      <h3>${item.wordlist.replace("_", " ")}, ${item.type} ${item.mode}</h3>
      <p class="settings">${settings}</p>
      ${$stats}
    </li>`
    })
    .join("\n")

  $main.innerHTML = `
    <h2><a href="${`https://monkeytype.com/profile/${username}`}" target="_blank">${username}</a></h2>
    ${$general}
    <h2>Top Scores:</h2>
    <ul id="stats">${$items}</ul>
  `

  document.title = `${username} - MonkeySpy`
}

$form.addEventListener("submit", async (e) => {
  e.preventDefault()
  const username = $username.value.trim()
  await loadUserStats(username)
  location.hash = username
  $username.value = ""
})

if (location.hash) {
  loadUserStats(location.hash.slice(1))
} else {
  $username.focus()
}
