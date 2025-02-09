import BlogPostUtil, { BlogPost, BlogPostHeader } from "../Utils/BlogPost";
import { BlogRootPath, ViewsPath } from "../Utils/Config";
import NotFoundUtil from "../Utils/NotFound";
import ServerErrorUtil from "../Utils/ServerError";
import Text from "Common/Types/Text";
import Express, {
  ExpressApplication,
  ExpressRequest,
  ExpressResponse,
} from "Common/Server/Utils/Express";
import logger from "Common/Server/Utils/Logger";
import Response from "Common/Server/Utils/Response";
import Route from "Common/Types/API/Route";

const app: ExpressApplication = Express.getExpressApp();

// create redirect for old blog post urls. This is to handle old blog post urls that are indexed by search engines.

app.get(
  "/blog/post/:file",
  async (req: ExpressRequest, res: ExpressResponse) => {
    try {
      const fileName: string = req.params["file"] as string;

      return Response.redirect(
        req,
        res,
        new Route(`/blog/post/${fileName}/view`),
      );
    } catch (e) {
      logger.error(e);
      return ServerErrorUtil.renderServerError(res);
    }
  },
);

app.get(
  "/blog/post/:file/view",
  async (req: ExpressRequest, res: ExpressResponse) => {
    try {
      const fileName: string = req.params["file"] as string;

      const blogPost: BlogPost | null =
        await BlogPostUtil.getBlogPost(fileName);

      if (!blogPost) {
        return NotFoundUtil.renderNotFound(res);
      }

      res.render(`${ViewsPath}/Blog/Post`, {
        support: false,
        footerCards: true,
        cta: true,
        blackLogo: false,
        requestDemoCta: false,
        blogPost: blogPost,
      });
    } catch (e) {
      logger.error(e);
      return ServerErrorUtil.renderServerError(res);
    }
  },
);

app.get(
  "/blog/post/:postName/:fileName",
  async (req: ExpressRequest, res: ExpressResponse) => {
    // return static files for blog post images
    // the static files are stored in the /usr/src/blog/posts/:file/:imageName

    try {
      const fileName: string = req.params["fileName"] as string;
      const postName: string = req.params["postName"] as string;

      return Response.sendFileByPath(
        req,
        res,
        `${BlogRootPath}/posts/${postName}/${fileName}`,
      );
    } catch (e) {
      logger.error(e);
      return ServerErrorUtil.renderServerError(res);
    }
  },
);

// List all blog posts with tag

app.get(
  "/blog/tag/:tagName",
  async (req: ExpressRequest, res: ExpressResponse) => {
    try {
      const tagName: string = req.params["tagName"] as string;

      const blogPosts: Array<BlogPostHeader> =
        await BlogPostUtil.getBlogPostList(tagName);

      res.render(`${ViewsPath}/Blog/ListByTag`, {
        support: false,
        footerCards: true,
        cta: true,
        blackLogo: false,
        requestDemoCta: false,
        blogPosts: blogPosts,
        tagName: Text.fromDashesToPascalCase(tagName),
      });
    } catch (e) {
      logger.error(e);
      return ServerErrorUtil.renderServerError(res);
    }
  },
);

// main blog page
app.get("/blog", async (_req: ExpressRequest, res: ExpressResponse) => {
  try {
    const blogPosts: Array<BlogPostHeader> =
      await BlogPostUtil.getBlogPostList();

    res.render(`${ViewsPath}/Blog/List`, {
      support: false,
      footerCards: true,
      cta: true,
      blackLogo: false,
      requestDemoCta: false,
      blogPosts: blogPosts,
    });
  } catch (e) {
    logger.error(e);
    return ServerErrorUtil.renderServerError(res);
  }
});
