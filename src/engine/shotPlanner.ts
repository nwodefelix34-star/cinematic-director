export function planCinematicShots(prompt: string) {

  const base = prompt.trim()

  const shots = [

    {
      prompt: `${base}, wide establishing shot`,
      motion: "slow cinematic camera reveal"
    },

    {
      prompt: `${base}, medium shot focusing on main subject`,
      motion: "gentle camera push-in"
    },

    {
      prompt: `${base}, dramatic close-up with emotional detail`,
      motion: "subtle cinematic movement"
    }

  ]

  return shots.map(shot => {

    const frames = buildKeyframes(shot.prompt)

    return {
      ...shot,
      frames
    }

  })

}



function buildKeyframes(prompt: string) {

  const frames = []

  const maxFrames = 5

  const actions = [

    `${prompt}, beginning moment`,
    `${prompt}, action starting`,
    `${prompt}, action progressing`,
    `${prompt}, action nearing completion`,
    `${prompt}, final moment`

  ]

  for (let i = 0; i < actions.length; i++) {

    if (frames.length >= maxFrames) break

    frames.push(actions[i])

  }

  return frames

}
