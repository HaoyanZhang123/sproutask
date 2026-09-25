import { describe, expect, it } from 'vitest'
import {
  ANSWER_TITLE,
  THINK_TITLE,
  countMatches,
  extractCitation,
  matchesOnlyInCollapsed,
  parseSectionBlocks,
  splitHighlights
} from '@shared/section-blocks'

describe('小节正文解析', () => {
  it('普通段落解析为 text 块', () => {
    const blocks = parseSectionBlocks('第一段。\n\n第二段。')
    expect(blocks).toEqual([
      { type: 'text', body: '第一段。\n\n第二段。', index: 0 }
    ])
  })

  it('答案块默认标题为"参考答案"，并可出现在段落之间', () => {
    const blocks = parseSectionBlocks(['前言。', ':::answer', '答案是线粒体。', ':::', '后记。'].join('\n'))
    expect(blocks.map((b) => b.type)).toEqual(['text', 'answer', 'text'])
    expect(blocks[1]).toMatchObject({ title: ANSWER_TITLE, body: '答案是线粒体。' })
    expect(blocks[2]?.body).toBe('后记。')
  })

  it('想一想块保留自定义标题，缺省时为"想一想"', () => {
    const withTitle = parseSectionBlocks(':::think 讨论\n为什么？\n:::')
    expect(withTitle[0]).toMatchObject({ type: 'think', title: '讨论', body: '为什么？' })

    const withoutTitle = parseSectionBlocks(':::think\n想一想\n:::')
    expect(withoutTitle[0]).toMatchObject({ type: 'think', title: THINK_TITLE })
  })

  it('块内保留空行，块首尾空行被裁掉', () => {
    const blocks = parseSectionBlocks(':::answer\n\n第一行\n\n第二行\n\n:::\n')
    expect(blocks[0]?.body).toBe('第一行\n\n第二行')
  })

  it('多个块连续出现时不丢失，index 递增', () => {
    const blocks = parseSectionBlocks([':::think A', 'a', ':::', ':::answer', 'b', ':::'].join('\n'))
    expect(blocks.map((b) => b.type)).toEqual(['think', 'answer'])
    expect(blocks.map((b) => b.index)).toEqual([0, 1])
  })

  it('未闭合的块退化为普通文本（宁可多显示，不可静默隐藏）', () => {
    const blocks = parseSectionBlocks(['前言。', ':::answer', '这段忘了写结束标记。'].join('\n'))
    expect(blocks.map((b) => b.type)).toEqual(['text', 'text'])
    expect(blocks[1]?.body).toBe('这段忘了写结束标记。')
    // 关键：内容没有被折叠隐藏
    expect(blocks.some((b) => b.type === 'answer')).toBe(false)
  })

  it('空文本与纯空白返回空数组', () => {
    expect(parseSectionBlocks('')).toEqual([])
    expect(parseSectionBlocks('\n\n   \n')).toEqual([])
  })

  it('标记行前后的空白不影响识别', () => {
    const blocks = parseSectionBlocks('  :::answer  \n内容\n  :::  ')
    expect(blocks[0]).toMatchObject({ type: 'answer', body: '内容' })
  })

  it('代码风格的冒号开头的普通文本不会被误判', () => {
    const blocks = parseSectionBlocks(':: 这不是标记\n:::not-a-marker 也不是')
    expect(blocks.every((b) => b.type === 'text')).toBe(true)
  })
})

describe('搜索高亮切分', () => {
  it('按查询词切分并标记命中片段', () => {
    expect(splitHighlights('细胞膜控制物质进出', '细胞膜')).toEqual([
      { text: '细胞膜', hit: true },
      { text: '控制物质进出', hit: false }
    ])
  })

  it('多处命中全部标记', () => {
    const segments = splitHighlights('线粒体与叶绿体，线粒体把化学能释放出来', '线粒体')
    expect(segments.filter((s) => s.hit).map((s) => s.text)).toEqual(['线粒体', '线粒体'])
    expect(segments.map((s) => s.text).join('')).toBe('线粒体与叶绿体，线粒体把化学能释放出来')
  })

  it('空查询返回整段未命中', () => {
    expect(splitHighlights('任意文本', '  ')).toEqual([{ text: '任意文本', hit: false }])
    expect(splitHighlights('', 'x')).toEqual([])
  })

  it('命中次数统计与"只在折叠块中"判断', () => {
    const blocks = parseSectionBlocks(
      ['细胞的生活需要物质和能量。', ':::answer', '线粒体把化学能释放出来。', ':::'].join('\n')
    )
    expect(countMatches(blocks, '线粒体')).toBe(1)
    expect(countMatches(blocks, '物质')).toBe(1)
    expect(countMatches(blocks, '')).toBe(0)
    // 只有折叠答案里出现 → 界面可提示"命中在折叠的答案中"
    expect(matchesOnlyInCollapsed(blocks, '线粒体')).toBe(true)
    expect(matchesOnlyInCollapsed(blocks, '物质')).toBe(false)
  })
})

describe('出处定位', () => {
  const candidates = ['第二单元第一章第四节 细胞的生活', '细胞的生活', '细胞膜']

  it('优先命中候选词里最长的那个（避免只定位到宽泛词）', () => {
    const reply = '你看教材里"细胞的生活"这一节的第二段，再想想细胞膜的作用？'
    expect(extractCitation(reply, candidates)).toBe('细胞的生活')
  })

  it('候选词更长时优先（章节全称优于小节名）', () => {
    const reply = '见第二单元第一章第四节 细胞的生活'
    expect(extractCitation(reply, candidates)).toBe('第二单元第一章第四节 细胞的生活')
  })

  it('没有候选词命中时退回"第X节/第X章"形式', () => {
    expect(extractCitation('这个在第三单元第五章会学到', candidates)).toBe('第五章')
    expect(extractCitation('翻到第二节看看', [])).toBe('第二节')
  })

  it('没有出处时返回 null（界面不做定位）', () => {
    expect(extractCitation('你觉得细胞里的能量从哪里来？', candidates)).toBeNull()
    expect(extractCitation('', candidates)).toBeNull()
    expect(extractCitation('   ', candidates)).toBeNull()
  })
})
