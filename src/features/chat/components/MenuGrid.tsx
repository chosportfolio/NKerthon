import type { Language, Menu } from "../types/chat";

type Props = {
  menus: Menu[];
  language: Language;
  onMenuClick: (menu: Menu) => void;
};

export default function MenuGrid({
  menus,
  language,
  onMenuClick,
}: Props) {
  return (
    <div className="menu-grid">
      {menus.map((menu) => (
        <button
          key={menu.title.ko}
          type="button"
          className="menu-button"
          onClick={() => onMenuClick(menu)}
        >
          <img
            src={menu.icon}
            alt={menu.title[language]}
            className="menu-icon"
          />

          <span>{menu.title[language]}</span>
        </button>
      ))}
    </div>
  );
}
