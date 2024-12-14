import { Button } from "primereact/button";

interface Props {
  onClick: () => void;
  visible: boolean;
}

export default function ScrollBottomButton({ onClick, visible }: Props) {
  if (!visible) return null;

  return (
    <Button
      icon="pi pi-chevron-down"
      className="scroll-bottom-button p-button-rounded p-button-text hover:bg-gray-500"
      onClick={onClick}
      style={{
        position: "absolute",
        bottom: "30%",
        right: "50%",
        transform: "translateX(-50%)",
        width: "40px",
        color: "white",
        backgroundColor: "grey",
        height: "40px",
        boxShadow: "0 2px 4px rgba(0,0,0,.1)",
      }}
    />
  );
}
