import * as assert from "assert";
import { createElement, VNode, Fragment, ComponentChild } from "preact";
import type { Templates, TemplateProps } from "./templates";
import {
  ReflectionKind,
  ReflectionKindToModel,
  SomeReflection,
  Reflection,
} from "../models";
import { TypeTemplates } from "./type-templates";

// See the Templates interface for doc comments.
// TODO: Lots to do to make this good yet.

const kindNames: Record<ReflectionKind, string> = {
  [ReflectionKind.Project]: "", // We just want to display the name.
  [ReflectionKind.Module]: "Module",
  [ReflectionKind.Namespace]: "Namespace",
  [ReflectionKind.Enum]: "Enumeration",
  [ReflectionKind.EnumMember]: "Enumeration Member",
  [ReflectionKind.Variable]: "Variable",
  [ReflectionKind.Function]: "Function",
  [ReflectionKind.Class]: "Class",
  [ReflectionKind.Interface]: "Interface",
  [ReflectionKind.Object]: "Object",
  [ReflectionKind.Property]: "Property",
  [ReflectionKind.Accessor]: "Accessor",
  [ReflectionKind.Method]: "Method",
  [ReflectionKind.Signature]: "Signature",
  [ReflectionKind.Parameter]: "Parameter",
  [ReflectionKind.Alias]: "Type Alias",
  [ReflectionKind.Reference]: "Reference",
};

export const DefaultTemplates: Templates = {
  Page(props) {
    const { reflection, templates, hooks } = props;
    assert(reflection.project);
    return (
      <html>
        <head>
          {hooks.emit("head.begin", reflection)}
          <meta charSet="utf-8" />
          <meta
            name="description"
            content={`Documentation for ${reflection.project.name}`}
          />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="generator" content="typedoc" />
          <title>
            {reflection.isProject()
              ? reflection.name
              : `${reflection.name} | ${reflection.project.name}`}
          </title>
          <link
            rel="stylesheet"
            href={props.router.createAssetLink(reflection, "style.css")}
          />
          <link
            rel="stylesheet"
            href={props.router.createAssetLink(reflection, "theme.css")}
          />
          {hooks.emit("head.end", reflection)}
        </head>
        <body>
          {hooks.emit("body.begin", reflection)}
          <templates.Toolbar {...props} />
          <main>
            <templates.Header {...props} />
            <templates.Navigation {...props} />
            <section id="main">
              <templates.Reflection {...props} />
            </section>
            <templates.Footer {...props} />
          </main>
          {hooks.emit("body.end", reflection)}
        </body>
      </html>
    );
  },

  Toolbar(props) {
    const { reflection, router } = props;
    assert(reflection.project);

    return (
      <div class="toolbar">
        <a href={router.createLink(reflection, reflection.project)}>
          {reflection.project.name}
        </a>
        <input id="search" placeholder="Click or press S for search" />
        <select id="theme">
          <option value="native">Native</option>
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>
      </div>
    );
  },

  Header(props) {
    const { templates, reflection } = props;

    let displayName = reflection.name;
    if (
      reflection.kindOf(ReflectionKind.Class, ReflectionKind.Interface) &&
      reflection.typeParameters.length
    ) {
      displayName += `<${reflection.typeParameters
        .map((param) => param.toString())
        .join(", ")}>`;
    }

    return (
      <header>
        <div class="title">
          <templates.Breadcrumbs {...props} />
          <h1>
            {kindNames[reflection.kind]} {displayName}
          </h1>
        </div>
      </header>
    );
  },

  Navigation({ reflection, router }) {
    let navMembers: SomeReflection[];
    // Special case for use with a single entry point, we go straight from the project to the entry point's members.
    if (reflection.isProject() && reflection.children.length === 1) {
      navMembers = reflection.children[0].children;
    } else if (router.hasOwnDocument(reflection) && reflection.isContainer()) {
      navMembers = reflection.children;
    } else {
      assert(reflection.parent && reflection.parent.isContainer());
      navMembers = reflection.parent.children;
    }

    return (
      <nav>
        {navMembers.map((member) => (
          <a href={router.createLink(reflection, member)}>{member.name}</a>
        ))}
      </nav>
    );
  },

  Breadcrumbs({ reflection, router }) {
    const path: SomeReflection[] = [];
    let iter = reflection.parent;
    while (iter) {
      path.unshift(iter);
      iter = iter.parent;
    }

    if (path.length < 1) {
      return <Fragment />;
    }

    return (
      <ul class="breadcrumbs">
        {path.map((refl) => (
          <li>
            <a href={router.createLink(reflection, refl)}>{refl.name}</a>
          </li>
        ))}
      </ul>
    );
  },

  Footer() {
    // TODO hideGenerator, legend
    return (
      <footer>
        <p>
          Generated using{" "}
          <a href="https://typedoc.org/" target="_blank">
            TypeDoc
          </a>
        </p>
      </footer>
    );
  },

  // TODO: This needs to group according to categories.
  PageChildren(props) {
    const { router, reflection, templates } = props;
    return (
      <Fragment>
        {router.getChildrenInPage(reflection).map((child) => (
          <templates.Reflection
            {...props}
            reflection={child}
            displayName={`${kindNames[child.kind]} ${child.name}`}
          />
        ))}
      </Fragment>
    );
  },

  Reflection(props) {
    const {
      reflection,
      templates,
      hooks,
      router,
      highlighter,
      parseMarkdown,
      displayName,
    } = props;

    const templateMap: {
      [K in ReflectionKind]: (
        props: TemplateProps<ReflectionKindToModel[K]>
      ) => VNode;
    } = {
      [ReflectionKind.Project]: templates.Project,
      [ReflectionKind.Module]: templates.Module,
      [ReflectionKind.Namespace]: templates.Namespace,
      [ReflectionKind.Enum]: templates.Enum,
      [ReflectionKind.EnumMember]: templates.EnumMember,
      [ReflectionKind.Variable]: templates.Variable,
      [ReflectionKind.Function]: templates.Function,
      [ReflectionKind.Class]: templates.Class,
      [ReflectionKind.Interface]: templates.Interface,
      [ReflectionKind.Object]: templates.Object,
      [ReflectionKind.Property]: templates.Property,
      [ReflectionKind.Accessor]: templates.Accessor,
      [ReflectionKind.Method]: templates.Method,
      [ReflectionKind.Signature]: templates.Signature,
      [ReflectionKind.Parameter]: templates.Parameter,
      [ReflectionKind.Alias]: templates.TypeAlias,
      [ReflectionKind.Reference]: templates.Reference,
    };

    const Template = templateMap[reflection.kind];

    if (!Template) {
      const kindString =
        reflection.kind in ReflectionKind
          ? ReflectionKind.toKindString(reflection.kind)
          : `${reflection.kind}`;
      throw new Error(
        `Invalid reflection kind ${kindString} for reflection ${reflection.getFullName()}`
      );
    }

    const slug = router.createSlug(reflection) || "#";

    return (
      <Fragment>
        {hooks.emit("reflection.before", reflection)}
        <div
          class={`reflection reflection-${ReflectionKind.toKindString(
            reflection.kind
          )}`}
          id={slug} // Empty ID isn't valid HTML, and the slugger won't produce a `#`
        >
          {displayName && (
            <h3>
              <a href={"#" + slug}>#</a> {displayName}
            </h3>
          )}
          {hooks.emit("reflection.begin", reflection)}
          <Template
            // Don't just use {...props} here because we don't want to pass displayName through
            templates={templates}
            hooks={hooks}
            router={router}
            parseMarkdown={parseMarkdown}
            highlighter={highlighter}
            // Discriminated unions don't play nicely here... TS infers the required type to be `never`
            reflection={reflection as never}
          />
          {hooks.emit("reflection.end", reflection)}
        </div>
        {hooks.emit("reflection.after", reflection)}
      </Fragment>
    );
  },

  Comment({ reflection, parseMarkdown }) {
    const comment = reflection.comment;
    if (!comment) {
      return <Fragment />;
    }

    const parsed = parseMarkdown(
      `${comment.shortText}\n\n${comment.text}`,
      reflection
    );
    const rendered = (
      <div
        class="comment markdown"
        dangerouslySetInnerHTML={{ __html: parsed }}
      />
    );

    if (comment.tags?.length) {
      return (
        <Fragment>
          {rendered}
          <dl class="comment-tags">
            {comment.tags.map((tag) => (
              <Fragment>
                <dt>
                  {tag.tagName + (tag.paramName ? ` ${tag.paramName}` : "")}
                </dt>
                <dd
                  dangerouslySetInnerHTML={{
                    __html: parseMarkdown(tag.text, reflection),
                  }}
                ></dd>
              </Fragment>
            ))}
          </dl>
        </Fragment>
      );
    }

    return rendered;
  },

  Project(props) {
    const { reflection, templates, parseMarkdown } = props;

    return (
      <Fragment>
        <div
          class="markdown"
          dangerouslySetInnerHTML={{
            __html: parseMarkdown(reflection.readme, reflection),
          }}
        />
        <templates.PageChildren {...props} />
      </Fragment>
    );
  },

  Module(props) {
    const { templates } = props;

    // TODO: Index.
    return (
      <Fragment>
        <templates.Comment {...props} />
        <templates.PageChildren {...props} />
      </Fragment>
    );
  },

  Namespace(props) {
    const { templates } = props;

    return (
      <Fragment>
        <templates.Comment {...props} />
        <templates.PageChildren {...props} />
      </Fragment>
    );
  },

  Interface(props) {
    const { templates } = props;

    return (
      <Fragment>
        <templates.Comment {...props} />
        <templates.PageChildren {...props} />
      </Fragment>
    );
  },

  TypeAlias(props) {
    const { reflection, templates } = props;

    return (
      <Fragment>
        type {reflection.name}
        <templates.TypeParameters
          {...props}
          params={reflection.typeParameters}
        />
        {" = "}
        <templates.Type {...props} type={reflection.type} />
        <templates.Comment {...props} />
      </Fragment>
    );
  },

  Enum(props) {
    const { templates, reflection } = props;

    return (
      <Fragment>
        <templates.Comment {...props} />
        <table class="enum">
          <tbody>
            {reflection.children.map((child) => (
              <templates.EnumMember {...props} reflection={child} />
            ))}
          </tbody>
        </table>
      </Fragment>
    );
  },

  EnumMember(props) {
    const { templates, reflection } = props;

    return (
      <Fragment>
        <tr>
          <td>
            <p>
              {reflection.name} = {JSON.stringify(reflection.value)}
            </p>
          </td>
          <td>
            <templates.Comment {...props} />
          </td>
        </tr>
      </Fragment>
    );
  },

  Function(props) {
    const { reflection, templates } = props;

    return (
      <Fragment>
        {reflection.children.map((s) => {
          return <templates.Reflection {...props} reflection={s} />;
        })}
      </Fragment>
    );
  },

  Class(props) {
    const { templates } = props;

    return (
      <Fragment>
        <templates.Comment {...props} />
        <templates.PageChildren {...props} />
      </Fragment>
    );
  },

  Object(props) {
    const { reflection } = props;

    return <Fragment>TODO {reflection.name}</Fragment>;
  },

  Method(props) {
    const { reflection, templates } = props;

    return (
      <Fragment>
        {reflection.children.map((s) => {
          return <templates.Reflection {...props} reflection={s} />;
        })}
      </Fragment>
    );
  },

  Property(props) {
    const { reflection, templates } = props;

    return (
      <Fragment>
        {reflection.name}: <templates.Type {...props} type={reflection.type} />
        <templates.Comment {...props} />
      </Fragment>
    );
  },

  Accessor(props) {
    const { reflection, templates } = props;

    const type = reflection.hasGetter
      ? reflection.hasSetter
        ? "get/set"
        : "get"
      : "set";

    return (
      <Fragment>
        {type} {reflection.name}:{" "}
        <templates.Type {...props} type={reflection.type} />
        <templates.Comment {...props} />
      </Fragment>
    );
  },

  Variable(props) {
    const { reflection, templates } = props;

    return (
      <Fragment>
        {reflection.name}: <templates.Type {...props} type={reflection.type} />
        {reflection.defaultValue && ` = ${reflection.defaultValue}`}
        <templates.Comment {...props} />
      </Fragment>
    );
  },

  Signature(props) {
    const { reflection, templates } = props;

    const typeArgs = (
      <templates.TypeParameters {...props} params={reflection.typeParameters} />
    );

    const parameters = reflection.parameters.map((s, i) => {
      const rest = s.isRest ? "..." : "";
      const sep = s.isOptional ? "?: " : ": ";
      const init = s.defaultValue == null ? null : `= ${s.defaultValue}`;
      const comma = i === reflection.parameters.length - 1 ? null : ", ";
      return (
        <Fragment>
          {rest + s.name + sep}
          <templates.Type {...props} type={s.type} />
          {init}
          {comma}
        </Fragment>
      );
    });

    const renderedParameters = reflection.parameters.length ? (
      <Fragment>
        <h4>Parameters</h4>
        <ul>
          {reflection.parameters.map((p) => (
            <li>
              <templates.Reflection {...props} reflection={p} />
            </li>
          ))}
        </ul>
      </Fragment>
    ) : null;

    return (
      <Fragment>
        <div class="signature">
          {reflection.name}
          {typeArgs}({parameters}):{" "}
          <templates.Type {...props} type={reflection.returnType} />
        </div>
        <templates.Comment {...props} />
        {renderedParameters}
      </Fragment>
    );
  },

  Parameter(props) {
    const { reflection, templates } = props;
    return (
      <Fragment>
        <b>{reflection.name}</b>:{" "}
        <templates.Type type={reflection.type} {...props} />
        <br />
        <templates.Comment {...props} />
      </Fragment>
    );
  },

  Reference({ reflection, router }) {
    const referenced = reflection.resolve();
    if (referenced) {
      return (
        <Fragment>
          Re-exports{" "}
          <a href={router.createLink(reflection, referenced)}>
            {referenced.name}
          </a>
        </Fragment>
      );
    }

    return <Fragment>Re-exports {reflection.name}</Fragment>;
  },

  Type(props) {
    const { reflection, router, type } = props;
    if ("id" in props.type) {
      return <props.templates.Object {...props} reflection={props.type} />;
    }

    const linkTargets: (Reflection | string)[] = [];
    const template = TypeTemplates[props.type.kind];
    const typeString = template({
      ...props,
      type: type as never,
      linkTargets,
    });

    // Rather arbitrary cutoff here. With inferred types, the resulting type can be HUGE.
    // If we give Shiki a type which is too large, it will take an incredibly long time to
    // highlight... so disable highlighting for those types. See GH#1346 for a motivating example
    // where the inferred type results in a string >1MB in size.
    if (typeString.length > 200) {
      return <Fragment>{typeString}</Fragment>;
    }

    // Doesn't matter if we use ts/tsx here. There are no type assertions or
    // TSX elements within types. For now, the template will put all output on one line,
    // so we can just grab the first line.
    const tokens = props.highlighter.getTokens(
      `type _ = ${typeString}`,
      "ts"
    )[0];
    tokens.splice(
      0,
      tokens.findIndex((t) => /^\s*=/.test(t.content))
    );

    if (/^\s*=\s*$/.test(tokens[0].content)) {
      tokens.splice(0, 1);
    } else {
      tokens[0].content = tokens[0].content.replace(/^\s*=\s*/, "");
    }

    let targetIndex = 0;

    return (
      <Fragment>
        {tokens.map((token) => {
          const target = linkTargets[targetIndex];
          if (target instanceof Reflection && token.content === target.name) {
            targetIndex++;
            return (
              <a
                href={router.createLink(reflection, target)}
                class={token.class}
              >
                {token.content}
              </a>
            );
          } else if (target === token.content) {
            targetIndex++;
            return <span class={token.class}>{token.content}</span>;
          }
          return <span class={token.class}>{token.content}</span>;
        })}
      </Fragment>
    );
  },

  TypeParameters(props) {
    const { params, templates } = props;

    if (params.length === 0) {
      return <Fragment />;
    }

    const children: ComponentChild[] = ["<"];
    for (const param of params) {
      if (children.length !== 1) {
        children.push(", ");
      }
      children.push(param.name);
      if (param.constraint) {
        children.push(" extends ");
        children.push(<templates.Type {...props} type={param.constraint} />);
      }
      if (param.defaultValue) {
        children.push(" = ");
        children.push(<templates.Type {...props} type={param.defaultValue} />);
      }
    }
    children.push(">");

    return <Fragment>{children}</Fragment>;
  },
};
