const OBSWebSocket = require("obs-websocket-js")
const moment = require("moment")
const fs = require("fs")
require("dotenv").config()

const obs = new OBSWebSocket()
obs.on("error", err => {})

const sleep = ms => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const generateCountdownString = (now, eventTime) => {
  // Calculate components of the time remaining
  const duration = moment.duration(eventTime.diff(now))
  const hours = duration.get("hours")
  const minutes = duration.get("minutes")
  const seconds = duration.get("seconds")

  // If any value is greater than 0, we still have time to wait
  if (Math.max(hours, minutes, seconds) > 0) {
    let remaining = "in "
    if (hours > 0) remaining += hours + ":"
    remaining += minutes + ":"
    if (seconds < 10) remaining += "0"
    remaining += seconds
    return remaining
  } else {
    return false
  }
}

const countdown = targetTimestamp => {
  return new Promise(async resolve => {
    const eventTime = moment(targetTimestamp)

    let countdownString = generateCountdownString(moment(), eventTime)
    while (countdownString !== false) {
      fs.writeFileSync("./countdown.txt", countdownString)
      await sleep(1000)
      countdownString = generateCountdownString(moment(), eventTime)
    }

    fs.writeFileSync("./countdown.txt", "Soon!")
    await sleep(2000)
    resolve()
  })
}

const main = targetTimestamp => {
  obs
    .connect({ address: process.env.OBS_WS_ADDRESS, password: process.env.OBS_WS_PASSWORD })
    .then(async () => {
      // Go to start scene
      obs.send("SetCurrentScene", { "scene-name": process.env.OBS_START_SCENE })

      // Start countdown
      await countdown(targetTimestamp)

      // When done, show transition scene with delay if specified
      if (process.env.OBS_TRANSITION_SCENE !== "") {
        if (process.env.OBS_TRANSITION_DELAY > 0) await sleep(process.env.OBS_TRANSITION_DELAY)
        obs.send("SetCurrentScene", { "scene-name": process.env.OBS_TRANSITION_SCENE })
      }

      // Show end scene with delay if specified
      if (process.env.OBS_END_DELAY > 0) await sleep(process.env.OBS_END_DELAY)
      obs.send("SetCurrentScene", { "scene-name": process.env.OBS_END_SCENE })

      // Done!
      obs.disconnect()
    })
    .catch(err => {
      console.log(err)
    })
}

const targetTimestamp = process.argv[2]
if (
  targetTimestamp &&
  targetTimestamp.match(/^20[0-9]{2}-[01][0-9]-[0-3][0-9] [0-2][0-9]:[0-5][0-9]$/)
) {
  main(targetTimestamp)
} else {
  console.log('Usage: npm run countdown "yyyy-mm-dd hh:mm"')
}
