export interface NavItem {
  text: string
  url: string
  description?: string
  isFolder: boolean
  hasChildren: boolean
  isExternal: boolean
  expanded?: boolean
  children?: NavItem[]
  subGroups?: NavSubGroup[]
}

export interface NavSubGroup {
  title: string
  items: NavItem[]
}

export interface NavGroup {
  title: string
  icon: string
  expanded: boolean
  items: NavItem[]
}

export interface NavPanelData {
  title: string
  icon: string
  expanded: boolean
  groups: NavGroup[]
}

