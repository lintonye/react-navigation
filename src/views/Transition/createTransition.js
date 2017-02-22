function createIdRegexFilter(idRegexes) {
  return (id: string) => idRegexes.every(idRegex => id.match(idRegex));
}

export default function createTransition(Transition, ...idRegexes) {
  return Transition(createIdRegexFilter(idRegexes));
}

