// Curated stoic / warrior philosophy quotes.
// Rotated deterministically by date so every user sees the same quote on a given day,
// and a different one each day. No external calls, no AI cost, no misattributions.

export type WarriorQuote = {
  text: string;
  author: string;
};

export const WARRIOR_QUOTES: WarriorQuote[] = [
  // Miyamoto Musashi — The Book of Five Rings / Dokkōdō
  { text: 'From one thing, know ten thousand things.', author: 'Miyamoto Musashi' },
  { text: 'The way of the warrior is resolute acceptance of death.', author: 'Miyamoto Musashi' },
  { text: 'Do nothing that is of no use.', author: 'Miyamoto Musashi' },
  { text: 'Today is victory over yourself of yesterday; tomorrow is your victory over lesser men.', author: 'Miyamoto Musashi' },
  { text: 'Perceive that which cannot be seen with the eye.', author: 'Miyamoto Musashi' },
  { text: 'You can only fight the way you practice.', author: 'Miyamoto Musashi' },
  { text: 'Think lightly of yourself and deeply of the world.', author: 'Miyamoto Musashi' },
  { text: 'In strategy it is important to see distant things as if they were close.', author: 'Miyamoto Musashi' },
  { text: 'Do not regret what you have done.', author: 'Miyamoto Musashi' },
  { text: 'Step by step walk the thousand-mile road.', author: 'Miyamoto Musashi' },

  // Marcus Aurelius — Meditations
  { text: 'You have power over your mind — not outside events. Realize this, and you will find strength.', author: 'Marcus Aurelius' },
  { text: 'Waste no more time arguing what a good man should be. Be one.', author: 'Marcus Aurelius' },
  { text: 'The impediment to action advances action. What stands in the way becomes the way.', author: 'Marcus Aurelius' },
  { text: 'If it is not right, do not do it; if it is not true, do not say it.', author: 'Marcus Aurelius' },
  { text: 'Confine yourself to the present.', author: 'Marcus Aurelius' },
  { text: 'How much trouble he avoids who does not look to see what his neighbor says or does.', author: 'Marcus Aurelius' },
  { text: 'The best revenge is to be unlike him who performed the injury.', author: 'Marcus Aurelius' },
  { text: 'When you arise in the morning, think of what a precious privilege it is to be alive.', author: 'Marcus Aurelius' },
  { text: 'Our life is what our thoughts make it.', author: 'Marcus Aurelius' },
  { text: 'A man’s worth is no greater than the worth of his ambitions.', author: 'Marcus Aurelius' },

  // Sun Tzu — The Art of War
  { text: 'In the midst of chaos, there is also opportunity.', author: 'Sun Tzu' },
  { text: 'The supreme art of war is to subdue the enemy without fighting.', author: 'Sun Tzu' },
  { text: 'Know thy self, know thy enemy. A thousand battles, a thousand victories.', author: 'Sun Tzu' },
  { text: 'Victorious warriors win first and then go to war; defeated warriors go to war first and then seek to win.', author: 'Sun Tzu' },
  { text: 'Opportunities multiply as they are seized.', author: 'Sun Tzu' },
  { text: 'Appear weak when you are strong, and strong when you are weak.', author: 'Sun Tzu' },
  { text: 'He who knows when he can fight and when he cannot will be victorious.', author: 'Sun Tzu' },
  { text: 'Move swift as the wind and closely-formed as the wood.', author: 'Sun Tzu' },
  { text: 'The greatest victory is that which requires no battle.', author: 'Sun Tzu' },
  { text: 'Even the finest sword plunged into salt water will eventually rust.', author: 'Sun Tzu' },

  // Epictetus — Discourses / Enchiridion
  { text: 'It is not what happens to you, but how you react to it that matters.', author: 'Epictetus' },
  { text: 'No man is free who is not master of himself.', author: 'Epictetus' },
  { text: 'First say to yourself what you would be; and then do what you have to do.', author: 'Epictetus' },
  { text: 'Difficulties are things that show a person what they are.', author: 'Epictetus' },
  { text: 'He who laughs at himself never runs out of things to laugh at.', author: 'Epictetus' },
  { text: 'Wealth consists not in having great possessions, but in having few wants.', author: 'Epictetus' },
  { text: 'Don’t explain your philosophy. Embody it.', author: 'Epictetus' },
  { text: 'Make the best use of what is in your power, and take the rest as it happens.', author: 'Epictetus' },

  // Seneca
  { text: 'Luck is what happens when preparation meets opportunity.', author: 'Seneca' },
  { text: 'We suffer more in imagination than in reality.', author: 'Seneca' },
  { text: 'He who is brave is free.', author: 'Seneca' },
  { text: 'While we are postponing, life speeds by.', author: 'Seneca' },
  { text: 'Difficulties strengthen the mind, as labor does the body.', author: 'Seneca' },
  { text: 'Sometimes even to live is an act of courage.', author: 'Seneca' },
  { text: 'It is not the man who has too little, but the man who craves more, that is poor.', author: 'Seneca' },

  // Socrates
  { text: 'The only true wisdom is in knowing you know nothing.', author: 'Socrates' },
  { text: 'An unexamined life is not worth living.', author: 'Socrates' },
  { text: 'He is richest who is content with the least.', author: 'Socrates' },
  { text: 'Strong minds discuss ideas, average minds discuss events, weak minds discuss people.', author: 'Socrates' },

  // Xenophon
  { text: 'The sweetest of all sounds is praise.', author: 'Xenophon' },
  { text: 'Excess of grief for the dead is madness; for it is an injury to the living.', author: 'Xenophon' },
  { text: 'A horse is a thing of beauty… none will tire of looking at him as long as he displays himself in his splendor.', author: 'Xenophon' },
  { text: 'The wise man should consider that health is the greatest of human blessings.', author: 'Xenophon' },

  // Julius Caesar
  { text: 'It is easier to find men who will volunteer to die, than to find those who are willing to endure pain with patience.', author: 'Julius Caesar' },
  { text: 'Experience is the teacher of all things.', author: 'Julius Caesar' },
  { text: 'I came, I saw, I conquered.', author: 'Julius Caesar' },
  { text: 'In war, events of importance are the result of trivial causes.', author: 'Julius Caesar' },
  { text: 'If you must break the law, do it to seize power: in all other cases observe it.', author: 'Julius Caesar' },

  // Marcus Cato / Cato the Younger
  { text: 'I would rather have men ask why I have no statue, than why I have one.', author: 'Cato the Elder' },
  { text: 'After I am dead I would rather have men ask why I was not honored, than why I was.', author: 'Cato the Elder' },

  // Heraclitus
  { text: 'Out of every one hundred men, ten shouldn’t even be there, eighty are just targets, nine are the real fighters — we are lucky to have them, for they make the battle. Ah, but the one — one is a warrior.', author: 'Heraclitus' },
  { text: 'No man ever steps in the same river twice.', author: 'Heraclitus' },
  { text: 'Character is destiny.', author: 'Heraclitus' },

  // Leonidas / Spartan
  { text: 'Come and take them.', author: 'Leonidas of Sparta' },
  { text: 'A Spartan’s hand is his weapon.', author: 'Spartan Proverb' },
  { text: 'Return with your shield — or on it.', author: 'Spartan Mothers' },

  // Sun Bin / Wu Qi
  { text: 'When the army is dispatched, the strategy must be set.', author: 'Sun Bin' },
  { text: 'A general who advances without coveting fame and retreats without fearing disgrace, whose only thought is to protect his country, is the jewel of the kingdom.', author: 'Wu Qi' },

  // Lao Tzu
  { text: 'Mastering others is strength. Mastering yourself is true power.', author: 'Lao Tzu' },
  { text: 'A journey of a thousand miles begins with a single step.', author: 'Lao Tzu' },
  { text: 'He who knows others is wise; he who knows himself is enlightened.', author: 'Lao Tzu' },

  // Yamamoto Tsunetomo — Hagakure
  { text: 'The Way of the Samurai is found in death.', author: 'Yamamoto Tsunetomo' },
  { text: 'There is surely nothing other than the single purpose of the present moment.', author: 'Yamamoto Tsunetomo' },
  { text: 'It is bad when one thing becomes two. One should not look for anything else in the Way of the Samurai.', author: 'Yamamoto Tsunetomo' },

  // Takuan Sōhō
  { text: 'The mind must always be in the state of flowing.', author: 'Takuan Sōhō' },

  // Plutarch
  { text: 'What we achieve inwardly will change outer reality.', author: 'Plutarch' },
  { text: 'Courage stands halfway between cowardice and rashness.', author: 'Plutarch' },

  // Thucydides
  { text: 'The bravest are surely those who have the clearest vision of what is before them, glory and danger alike, and yet notwithstanding, go out to meet it.', author: 'Thucydides' },

  // Hannibal
  { text: 'I will either find a way, or make one.', author: 'Hannibal Barca' },

  // Alexander the Great
  { text: 'There is nothing impossible to him who will try.', author: 'Alexander the Great' },
  { text: 'I am not afraid of an army of lions led by a sheep; I am afraid of an army of sheep led by a lion.', author: 'Alexander the Great' },
];

/**
 * Days since a fixed epoch (UTC) — used so every user sees the same quote on the same day.
 */
const epochDays = (d: Date = new Date()): number => {
  const utc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.floor(utc / 86_400_000);
};

export const getDailyQuote = (date: Date = new Date()): WarriorQuote => {
  const idx = epochDays(date) % WARRIOR_QUOTES.length;
  return WARRIOR_QUOTES[idx];
};
