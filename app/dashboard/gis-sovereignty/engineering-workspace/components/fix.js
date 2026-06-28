const fs = require('fs');
let code = fs.readFileSync('MapCanvas.tsx', 'utf8');

const target = `    map.getInteractions().forEach((interaction) => {
      if (interaction instanceof Draw || interaction instanceof Modify || interaction instanceof Select) {
        map.removeInteraction(interaction);
      }
    });`;

const replacement = `    const interactionsToRemove = map.getInteractions().getArray().filter(
      i => i instanceof Draw || i instanceof Modify || i instanceof Select || i instanceof Snap
    );
    interactionsToRemove.forEach(i => map.removeInteraction(i));`;

code = code.replace(target, replacement);

fs.writeFileSync('MapCanvas.tsx', code);
console.log('Fixed MapCanvas leaks');
