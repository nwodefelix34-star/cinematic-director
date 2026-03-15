export function planCinematicShots(prompt: string): {
  prompt: string
  motion: string
  frames: string[]
}[] {

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

  const frames: string[] = []

  const actions = [

    `${prompt}, beginning moment`,
    `${prompt}, action starting`,
    `${prompt}, action progressing`,
    `${prompt}, action nearing completion`,
    `${prompt}, final moment`

  ]

  for (const action of actions) {
    frames.push(action)
  }

  return frames

}
