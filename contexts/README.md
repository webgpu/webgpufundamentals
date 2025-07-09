# Contexts for AI agents

I'm new to AI. A contributor in another project translated 100+ articles from English to Russian
using Cursor. I thought I'd try the same for Japanese. I only have access to Gemini Code Assist
so I gave that a try.

My prompt was

> Please read @contexts/translation.md and follow the instructions

It proceeded to translate all the files though,

* 3 times it stopped and I had to click continue

* 3 files it removed all linefeeds

  the builder couldn't read these so easily found

  * Fixing 2 it fixed by just telling it to fix file X
  * The last it took 3 tries for some reason

* 1 file it translated a link from [caption](webgpu-import-textures.html) to [caption](webgpu-importing-textures.html).
  
  fortunately the builder noticed that issue

I listed all articles translation.md. I probably should have exclude the 3 articles that
were hand translated. I did not commit the generated translations and just left the originals.
They may or may not have been the right thing to do as the originals were translated a while
ago and since then there have been minor edits to the English. Those edits might not have
made it to the existing Japanese translations but I didn't want to risk that the generated
translations are worse. You can find the machine translated articles in the ja-auto-translations
branch.

Note that I have not proofread any of the articles. I'm just assuming they are passable and
users will post pull requests if they run into issues 🤞  I did notice that it translated
some WebGPU labels and not others.

