import TopSection, {
  ComponentProps,
} from "../../../UI/Components/TopSection/TopSection";
import { describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom/extend-expect";
import { render, screen } from "@testing-library/react";
import React from "react";

describe("TopSection", () => {
  const defaultProps: ComponentProps = {
    header: <div>Header</div>,
    navbar: <div>Navbar</div>,
  };
  const defaultClassName: string = "bg-white shadow";

  it("should render correctly", () => {
    render(<TopSection {...defaultProps} />);

    const banner: HTMLElement = screen.getByRole("banner");
    expect(banner).toHaveClass(defaultClassName);

    const header: HTMLElement = screen.getByText("Header");
    expect(header).toBeInTheDocument();

    const navbar: HTMLElement = screen.getByText("Navbar");
    expect(navbar).toBeInTheDocument();
  });

  it("should render correctly with custom className", () => {
    const customClassName: string = "customClassName";
    render(
      <TopSection {...defaultProps} className={customClassName}></TopSection>,
    );

    const banner: HTMLElement = screen.getByRole("banner");
    expect(banner).toHaveClass(customClassName);
  });

  it("should render correctly with hideHeader", () => {
    render(<TopSection {...defaultProps} hideHeader />);

    const header: HTMLElement | null = screen.queryByText("Header");
    expect(header).not.toBeInTheDocument();
  });
});
