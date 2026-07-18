import {
  branchStorySchema,
  storyInputSchema,
  type BranchStory,
  type StoryInput,
} from "./story";

export function generateMockStory(input: StoryInput): BranchStory {
  const values = storyInputSchema.parse(input);
  const { theme, protagonistName: name, protagonistIdentity: identity, storyStyle } =
    values;

  return branchStorySchema.parse({
    id: crypto.randomUUID(),
    title: `${theme}：午夜未寄出的回信`,
    premise: `${name}是一名${identity}。在一个${storyStyle}的夜晚，${theme}以一封没有署名的信闯入了生活。`,
    theme,
    style: storyStyle,
    protagonist: { name, identity },
    startNodeId: "start",
    nodes: [
      {
        id: "start",
        content: `${name}下班时，在门缝里发现一封写着自己名字的旧信。信纸带着雨后的气味，末尾只有一句：“想知道${theme}的答案，就在午夜前作出选择。”`,
        endingType: null,
        choices: [
          { id: "open", text: "现在拆开信封", nextNodeId: "follow-light" },
          { id: "wait", text: "先去寻找寄信的人", nextNodeId: "follow-footsteps" },
        ],
      },
      {
        id: "follow-light",
        content: `信里夹着一张旧车票。${name}抬头时，一辆早已停运的夜班车正停在街角，车内亮着温暖的灯。`,
        endingType: null,
        choices: [
          { id: "board", text: "登上夜班车", nextNodeId: "ending-home" },
          { id: "keep-ticket", text: "收好车票，继续步行", nextNodeId: "ending-dawn" },
        ],
      },
      {
        id: "follow-footsteps",
        content: `${name}沿着潮湿的脚印走进小巷，看见年少时的自己站在一盏路灯下，手中也拿着同样的信。`,
        endingType: null,
        choices: [
          { id: "speak", text: "走上前与过去对话", nextNodeId: "ending-answer" },
          { id: "observe", text: "安静地陪伴一会儿", nextNodeId: "ending-release" },
        ],
      },
      {
        id: "ending-home",
        content: `夜班车没有驶向远方，而是停在${name}一直不敢回去的那扇门前。门后的人没有追问迟到的原因，只递来一杯热茶。原来${theme}的答案，不是出发，而是终于允许自己回家。`,
        endingType: "hopeful",
        choices: [],
      },
      {
        id: "ending-dawn",
        content: `${name}走到天亮，车票在掌心慢慢褪成一张空白纸。没有奇迹替人决定方向，但晨光让那名${identity}第一次看清：未写下的部分，仍然可以由自己继续。`,
        endingType: "bittersweet",
        choices: [],
      },
      {
        id: "ending-answer",
        content: `年少的${name}问：“后来我们成为想成为的人了吗？”${name}没有给出完美答案，只认真讲述一路的失去与坚持。路灯熄灭前，过去的自己笑了——诚实本身，就是${theme}留下的礼物。`,
        endingType: "hopeful",
        choices: [],
      },
      {
        id: "ending-release",
        content: `两个人隔着一场旧雨坐到午夜。钟声响起时，年少的身影随脚印一起淡去。${name}仍有遗憾，却不再需要追回每个答案。那封信最终没有打开，也已经完成了使命。`,
        endingType: "bittersweet",
        choices: [],
      },
    ],
  });
}
