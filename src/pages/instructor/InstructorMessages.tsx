import { Inbox } from "@/components/messaging/Inbox";
import { InstructorTabBar } from "@/components/InstructorTabBar";

const InstructorMessages = () => (
  <Inbox variant="instructor" basePath="/instructor/messages" TabBar={InstructorTabBar} />
);

export default InstructorMessages;
