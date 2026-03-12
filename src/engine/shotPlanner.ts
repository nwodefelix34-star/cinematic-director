export function planCinematicShots(prompt: string) {

  const base = prompt.trim()

  return [

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

}
