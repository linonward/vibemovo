import { projectConfig } from "project.config";

// Components available inside content/legal/*.mdx without imports.
export function ProjectName() {
  return <>{projectConfig.name}</>;
}

export function SupportEmail() {
  return (
    <a
      href={`mailto:${projectConfig.supportEmail}`}
      className="font-medium text-primary-text underline underline-offset-4"
    >
      {projectConfig.supportEmail}
    </a>
  );
}
