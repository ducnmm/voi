"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { Children, isValidElement, useRef, useState, type ReactNode, type ComponentPropsWithoutRef } from "react";
import { Icon } from "./icon";

type Props = Omit<ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>, "value" | "children" | "onChange"> & {
  value: string | number;
  onValueChange: (value: string) => void;
  children: ReactNode;
  name?: string;
  required?: boolean;
};
type Option = { value: string; label: ReactNode; disabled?: boolean };
function optionsFromChildren(children: ReactNode): Option[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>(child)) return [];
    if (child.type !== "option") return optionsFromChildren(child.props.children);
    return [{ value: String(child.props.value ?? ""), label: child.props.children, disabled: child.props.disabled }];
  });
}
function optionText(children: ReactNode): string {
  return Children.toArray(children).map((child): string => {
    if (typeof child === "string" || typeof child === "number") return String(child);
    return isValidElement<{ children?: ReactNode }>(child) ? optionText(child.props.children) : "";
  }).join("");
}

/** A styled, keyboard-accessible select. Native <option> children describe data only. */
export function Select({ value, onValueChange, children, className = "", disabled, required, name, ...props }: Props) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | undefined>();
  const [menuWidth, setMenuWidth] = useState(180);
  const options = optionsFromChildren(children);
  const selected = options.find((option) => option.value === String(value)) ?? options[0];
  // Encoding every value lets the legitimate empty-string option coexist with Radix's placeholder sentinel.
  const encode = (value: string) => `value:${value}`;
  return (
    <SelectPrimitive.Root value={selected ? encode(selected.value) : ""}
      onValueChange={(next) => onValueChange(next.slice(6))} disabled={disabled}
      required={required} name={name}
      onOpenChange={(open) => {
        if (open) {
          setPortalContainer(trigger.current?.closest("dialog") ?? undefined);
          setMenuWidth(Math.max(180, trigger.current?.offsetWidth ?? 180));
        }
      }}>
      <SelectPrimitive.Trigger {...props} ref={trigger} className={`select-trigger ${className}`}>
        <SelectPrimitive.Value />
        <SelectPrimitive.Icon className="select-chevron"><Icon name="chevron" size={14} /></SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal container={portalContainer}>
        <SelectPrimitive.Content className="select-menu" style={{ minWidth: menuWidth }} position="popper" align="end" sideOffset={6}
          collisionPadding={12} onEscapeKeyDown={(event) => event.stopPropagation()}>
          <SelectPrimitive.ScrollUpButton className="select-scroll select-scroll-up"><Icon name="chevron" size={14} /></SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="select-options">
            {options.map((option) => (
              <SelectPrimitive.Item key={option.value} value={encode(option.value)} disabled={option.disabled}
                textValue={optionText(option.label)} className="select-option">
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="select-check"><Icon name="check" size={16} /></SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="select-scroll"><Icon name="chevron" size={14} /></SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
