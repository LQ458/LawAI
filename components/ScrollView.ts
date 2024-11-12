import { useEffect } from "react";
import { Chat } from "@/types";

export default function ScrollView({
  data,
  ref,
}: {
  data: Chat | null;
  ref: React.RefObject<HTMLDivElement>;
}) {
  useEffect(() => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [data, ref]);
}
