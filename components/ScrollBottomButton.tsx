import { Button } from "primereact/button";

interface Props {
  onClick: () => void;
  visible: boolean;
}

const ScrollBottomButton = ({ visible, onClick }: Props) => {
  if (!visible) return null;

  return (
    <Button
      icon="pi pi-chevron-down"
      onClick={onClick}
      className="scroll-bottom-button p-button-rounded p-button-text hover:bg-gray-500"
      style={{
        position: "absolute",
        bottom: "30%",
        right: "50%",
        transform: "translateX(-50%)",
        width: "40px",
        height: "40px",
        color: "white",
        backgroundColor: "grey",
        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
        borderRadius: "50%",
        aspectRatio: "1",
      }}
    />
  );
};

export default ScrollBottomButton;
