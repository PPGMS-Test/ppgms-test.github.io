import { normalizePath } from './utils.js'

/**
 * 将扫描得到的树形结构转化为前端导航所需的多层级（最高4层）导航 JSON 数据
 * 结构：panel -> groups -> subGroups -> subSubGroups -> items (可折叠)
 * 并且对直接位于各个层级上的文件（HTML/JSON Link）进行归一化包装
 *
 * @param {Object} tree - scanDir() 扫描返回的根树结构
 * @returns {Array} 前端渲染所需的数据结构
 */
export function generateNavData(tree) {
  // 第 1 层：最外层的 panel 模块
  return tree.children.map(panel => {

    // 获取当前 panel 下的直接文件（如果有的话）
    const directFiles = panel.files.map(f => ({
      description: '',
      url: f.isExternal ? f.href : normalizePath(f.path),
      text: f.title,
      isFolder: false,
      hasChildren: false,
      isExternal: f.isExternal || false
    }))

    // 过滤掉因为父级含有 index.html 而被标记为在导航中隐藏的子文件夹
    const visibleGroups = panel.children.filter(g => !g.hiddenFromNav)

    // 第 2 层：groups
    const groups = visibleGroups.map(group => {
      // 获取当前 group 下的直接文件
      const groupFiles = group.files.map(f => ({
        description: '',
        url: f.isExternal ? f.href : normalizePath(f.path),
        text: f.title,
        isFolder: false,
        hasChildren: false,
        isExternal: f.isExternal || false
      }))

      // 第 3 层：subGroups (当前 group 下的可见子文件夹)
      const subGroups = group.children
        .filter(sub => !sub.hiddenFromNav)
        .map(sub => {
        // 获取当前 subGroup 下的直接文件
        const subFiles = sub.files.map(f => ({
          description: '',
          url: f.isExternal ? f.href : normalizePath(f.path),
          text: f.title,
          isFolder: false,
          hasChildren: false,
          isExternal: f.isExternal || false
        }))

        // 第 4 层：subSubGroups (最内层的折叠文件夹)
        const subSubGroups = sub.children
        .filter(subsub => !subsub.hiddenFromNav)
        .map(subsub => {
          // 最内层的文件
          const subsubFiles = subsub.files.map(f => ({
            description: '',
            url: f.isExternal ? f.href : normalizePath(f.path),
            text: f.title,
            isFolder: false,
            hasChildren: false,
            isExternal: f.isExternal || false
          }))

          // 第 4 层的格式组装
          return {
            description: subsub.title,
            url: normalizePath(subsub.files[0]?.path || subsub.path), // 当成主链接
            text: subsub.title,
            isFolder: true,
            expanded: subsub.expanded,
            hasChildren: subsub.children.length > 0 || subsub.files.length > 0,
            children: subsubFiles,
            // 如果下面还有内容（超出了4层设计），通过继续遍历其子元素显示在当前下拉列表中
            subGroups: subsub.children.map(g => ({
              description: g.title,
              url: normalizePath(g.files[0]?.path || g.path),
              text: g.title,
              isFolder: true,
              expanded: g.expanded,
              hasChildren: g.children.length > 0 || g.files.length > 0,
              children: g.files.map(f => ({
                description: '',
                url: f.isExternal ? f.href : normalizePath(f.path),
                text: f.title,
                isFolder: false,
                hasChildren: false,
                isExternal: f.isExternal || false
              }))
            }))
          }
        })

        // 第 3 层的格式组装
        return {
          description: sub.title,
          url: normalizePath(sub.files[0]?.path || sub.path),
          text: sub.title,
          isFolder: true,
          expanded: sub.expanded,
          hasChildren: sub.children.length > 0 || sub.files.length > 0,
          children: subFiles,
          subGroups: subSubGroups
        }
      })

      // 第 2 层的组装：把 group 下的直接文件和其内部展开的 subGroups 铺平显示在下拉选项里
      return {
        title: group.title,
        icon: group.icon,
        expanded: group.expanded,
        items: [...groupFiles, ...subGroups]
      }
    })

    // 处理：如果 panel 只有直接文件（没有子文件夹），则创建一个与 panel 同名的默认 group 包置文件
    if (groups.length === 0 && directFiles.length > 0) {
      return {
        title: panel.title,
        icon: panel.icon,
        expanded: panel.expanded,
        groups: [{
          title: panel.title,
          icon: panel.icon,
          expanded: panel.expanded,
          items: directFiles
        }]
      }
    }

    // 处理：如果 panel 同时有直接文件和子文件夹，则将这些文件作为该 panel 的第一个默认 group
    if (directFiles.length > 0 && groups.length > 0) {
      return {
        title: panel.title,
        icon: panel.icon,
        expanded: panel.expanded,
        groups: [{
          title: panel.title,
          icon: panel.icon,
          expanded: panel.expanded,
          items: directFiles
        }, ...groups]
      }
    }

    // 默认情况：将所有的 groups 包在 panel 内
    return {
      title: panel.title,
      icon: panel.icon,
      expanded: panel.expanded,
      groups: groups
    }
  }).filter(col => col.groups.length > 0)
}
